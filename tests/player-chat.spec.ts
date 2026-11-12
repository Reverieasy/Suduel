import { expect, test } from '@playwright/test'
import type { RoomSnapshot } from '../src/features/multiplayer/types'
import type { ChatMessage } from '../src/features/multiplayer/chat'

test('Leaderboard uses account names and opens the selected player from the object-shaped profile join',async({page})=>{
  const accounts=['GridWizard','LogicRival'].map(username=>({id:crypto.randomUUID(),username,display_name:`${username} Display`,avatar_url:null,bio:'Ready to solve.'}))
  await page.route('**/rest/v1/player_ratings?*',route=>{
    const url=new URL(route.request().url())
    const rating={rating:1450,rank_tier:'Gold',ranked_matches:12,current_streak:2,best_streak:4}
    return route.fulfill({json:url.searchParams.has('user_id')?[rating]:accounts.map(account=>({...rating,user_id:account.id,profiles:{username:account.username,display_name:account.display_name,avatar_url:null}}))})
  })
  await page.route('**/rest/v1/profiles?*',route=>{
    const username=new URL(route.request().url()).searchParams.get('username')?.slice(3)
    return route.fulfill({json:accounts.filter(account=>account.username===username)})
  })
  await page.goto('/tests/fixtures/player-harness.html')
  for(const account of accounts){
    const row=page.getByRole('link').filter({hasText:`@${account.username}`})
    await expect(row).toHaveAttribute('href',`/players/${account.username}`)
    await row.click()
    await expect(page.getByRole('heading',{level:1})).toHaveText(account.display_name)
    await expect(page.locator('.profile-handle')).toHaveText(`@${account.username}`)
    await expect(page.getByText('Player not found.',{exact:true})).toHaveCount(0)
    await page.getByRole('link',{name:'LEADERBOARD',exact:true}).click()
  }
  await page.setViewportSize({width:390,height:844})
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

test('Opponent chat sends plain text, receives confirmed history, preserves retry drafts and never moves the board',async({page})=>{
  let state:RoomSnapshot
  let messages:ChatMessage[]=[]
  const requests:{p_body:string;p_action_id:string;p_room:string}[]=[]
  let fail=true
  await page.route('**/rest/v1/rpc/suduel_command',async route=>{
    state??=await page.evaluate(()=>(window as unknown as {__suduelFixtureSnapshot:RoomSnapshot}).__suduelFixtureSnapshot)
    state.server_now=new Date().toISOString();await route.fulfill({json:state})
  })
  await page.route('**/rest/v1/room_chat_messages?*',route=>route.fulfill({json:[...messages].reverse()}))
  await page.route('**/rest/v1/rpc/send_room_chat',async route=>{
    const body=route.request().postDataJSON();requests.push(body)
    if(fail){fail=false;await route.fulfill({status:503,json:{message:'Try sending again.'}});return}
    const message={id:1,room_id:state.room.id,user_id:state.players[0].user_id,body:body.p_body,created_at:new Date().toISOString()}
    messages=[message];await route.fulfill({json:message})
  })
  await page.goto('/tests/fixtures/room-harness.html?view=room-page')
  const grid=page.getByRole('grid',{name:'Sudoku puzzle',exact:true})
  await expect(grid).toBeVisible();await page.evaluate(()=>document.fonts.ready)
  const box=await grid.boundingBox()
  await page.getByRole('button',{name:'Opponent chat',exact:true}).click()
  const input=page.getByRole('textbox',{name:'Message your opponent'})
  await expect(input).toBeFocused();await input.fill('Good luck <img src=x onerror=alert(1)>!')
  await input.press('Enter')
  await expect(page.getByText('Try sending again.',{exact:true})).toBeVisible()
  await expect(input).toHaveValue('Good luck <img src=x onerror=alert(1)>!')
  await input.press('Enter')
  await expect(input).toHaveValue('')
  expect(requests).toHaveLength(2);expect(requests[1]).toEqual(requests[0])
  await expect(page.getByRole('log')).toContainText('Good luck <img src=x onerror=alert(1)>!')
  await expect(page.getByRole('log').locator('img')).toHaveCount(0)
  messages.push({id:2,room_id:state!.room.id,user_id:state!.players[1].user_id,body:'Have fun!',created_at:new Date().toISOString()})
  await expect(page.getByRole('log')).toContainText('Have fun!',{timeout:7000})
  await expect(page.getByRole('log')).toContainText(`@${state!.players[1].username}`)
  expect(await grid.boundingBox()).toEqual(box)
  await input.fill('1');await input.press('Shift+Enter');expect(requests).toHaveLength(2)
  await input.press('Escape');await expect(page.getByRole('dialog',{name:'Opponent chat'})).toHaveCount(0)
  await expect(page.getByRole('button',{name:'Opponent chat',exact:true})).toBeFocused()
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Opponent chat',exact:true}).click()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
})

for(const width of [390,1440])test(`Closed chat notifies once, keeps unread until opened, and stays quiet when open at ${width}px`,async({page},testInfo)=>{
  await page.setViewportSize({width,height:900})
  let state:RoomSnapshot
  const messages:ChatMessage[]=[]
  let reads=0
  await page.route('**/rest/v1/rpc/suduel_command',async route=>{
    state??=await page.evaluate(()=>(window as unknown as {__suduelFixtureSnapshot:RoomSnapshot}).__suduelFixtureSnapshot)
    state.server_now=new Date().toISOString();await route.fulfill({json:state})
  })
  await page.route('**/rest/v1/room_chat_messages?*',async route=>{
    // Pre-existing history must never appear as a fresh notification on entry.
    if(!messages.length)messages.push({id:1,room_id:state.room.id,user_id:state.players[1].user_id,body:'Earlier message',created_at:new Date().toISOString()})
    await route.fulfill({json:[...messages].reverse()});reads++
  })
  await page.goto('/tests/fixtures/room-harness.html?view=room-page')
  const trigger=page.getByRole('button',{name:'Opponent chat',exact:true}), preview=page.locator('.chat-preview'), dot=page.locator('.chat-unread-dot')
  const grid=page.getByRole('grid',{name:'Sudoku puzzle',exact:true})
  await expect(grid).toBeVisible();await expect.poll(()=>reads).toBeGreaterThan(0)
  await page.evaluate(()=>document.fonts.ready)
  const cell=grid.getByRole('button').first();await cell.focus();const box=await grid.boundingBox()
  await expect(dot).toHaveCount(0);await expect(preview).toHaveCount(0)
  const add=(id:number,body:string,own=false)=>messages.push({id,room_id:state.room.id,user_id:state.players[own?0:1].user_id,body,created_at:new Date().toISOString()})
  const before=reads;add(2,'Own message echo',true)
  await expect.poll(()=>reads,{timeout:7000}).toBeGreaterThan(before)
  await expect(dot).toHaveCount(0);await expect(preview).toHaveCount(0)
  add(3,'Ready for the next grid? <b>Good luck!</b>')
  await expect(preview).toContainText('Ready for the next grid?',{timeout:7000})
  await expect(preview).toContainText(`@${state!.players[1].username}`)
  await expect(preview.locator('b')).toHaveCount(0)
  await expect(trigger).toHaveAccessibleDescription('Unread messages')
  await expect(dot).toHaveCount(1);await expect(cell).toBeFocused();expect(await grid.boundingBox()).toEqual(box)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  await page.screenshot({path:testInfo.outputPath(`unread-preview-${width}.png`)})
  // Repeated fallback polls must not replay the preview or reset its lifetime.
  await expect(preview).toHaveCount(0,{timeout:7000});await expect(dot).toHaveCount(1)
  add(4,'Another message')
  await expect(preview).toContainText('Another message',{timeout:7000})
  await page.getByRole('button',{name:'Dismiss message preview'}).click()
  await expect(preview).toHaveCount(0);await expect(dot).toHaveCount(1)
  await trigger.click()
  await expect(dot).toHaveCount(0);await expect(preview).toHaveCount(0)
  await expect(page.getByRole('textbox',{name:'Message your opponent'})).toBeFocused()
  add(5,'Already reading this one')
  await expect(page.getByRole('log')).toContainText('Already reading this one',{timeout:7000})
  await expect(dot).toHaveCount(0);await expect(preview).toHaveCount(0)
  await page.getByRole('button',{name:'Close chat',exact:true}).click()
  add(6,'Tap to reply')
  await expect(preview).toContainText('Tap to reply',{timeout:7000})
  await page.getByRole('button',{name:'Open unread opponent message'}).click()
  await expect(page.getByRole('dialog',{name:'Opponent chat'})).toBeVisible()
  await expect(dot).toHaveCount(0);await expect(preview).toHaveCount(0)
})
