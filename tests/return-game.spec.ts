import { expect, test, type Page } from '@playwright/test'
import type { RoomSnapshot } from '../src/features/multiplayer/types'
import type { Session } from '@supabase/supabase-js'

// Presentation/auth-state fixtures; no test accounts or real game commands.
async function fixture(page:Page,mode:'battle'|'classic'='battle') {
  let state:RoomSnapshot
  let status:'active'|'finished'|'closed'|'missing'|'error'|'intermission'='active'
  let reads=0, commands=0
  await page.route('**/rest/v1/room_chat_messages?*',route=>route.fulfill({json:[]}))
  await page.route('**/rest/v1/rpc/suduel_command',async route=>{
    commands++
    if(!state){
      state=await page.evaluate(()=>(window as unknown as {__suduelFixtureSnapshot:RoomSnapshot}).__suduelFixtureSnapshot)
      if(mode==='classic'){state.battle=null;state.room.mode='classic';state.match!.mode='classic'}
    }
    const body=route.request().postDataJSON()
    if(body.p_command==='forfeit'){
      state.match!.status='finished';state.match!.completed_at=new Date().toISOString();state.match!.outcome='forfeit';state.match!.winner_id=state.players[1].user_id
      if(state.battle){state.battle.series.status='finished';state.battle.series.outcome='forfeit';state.battle.series.winner_id=state.players[1].user_id}
      status='finished'
    }
    state.server_now=new Date().toISOString()
    await route.fulfill({json:state})
  })
  await page.route('**/rest/v1/game_rooms?*',async route=>{
    const url=new URL(route.request().url())
    expect(route.request().method()).toBe('GET')
    expect(url.searchParams.get('id')).toBe(`eq.${state.room.id}`)
    expect(url.searchParams.get('code')).toBe('eq.A1B2C3D4')
    expect(url.searchParams.get('select')).not.toMatch(/clues|entries|solution/)
    reads++
    if(status==='error'){await route.fulfill({status:503,json:{message:'Temporarily unavailable'}});return}
    await route.fulfill({json:status==='missing'?[]:[{
      id:state.room.id,code:state.room.code,status:status==='closed'?'closed':'playing',expires_at:state.room.expires_at,
      current_match:{status:status==='finished'||status==='intermission'?'finished':'active',ends_at:state.match!.ends_at,series:mode==='battle'?{status:status==='finished'?'finished':'active'}:null},
    }]})
  })
  await page.goto('/tests/fixtures/room-harness.html?view=room-page')
  await expect(page.getByRole('grid',{name:'Sudoku puzzle',exact:true})).toBeVisible()
  return {get state(){return state},get reads(){return reads},get commands(){return commands},status:(value:typeof status)=>{status=value}}
}

for(const mode of ['battle','classic'] as const)test(`${mode}: accidental home navigation offers the same game without sending heartbeats while away`,async({page},testInfo)=>{
  await page.setViewportSize({width:mode==='battle'?390:1440,height:900})
  const server=await fixture(page,mode)
  const notice=page.getByRole('status',{name:'Return to your game'}), grid=page.getByRole('grid',{name:'Sudoku puzzle',exact:true})
  const entries=await grid.textContent()
  await expect(notice).toHaveCount(0)
  await page.getByRole('link',{name:'SUDUEL home',exact:true}).first().click()
  await expect(notice).toContainText('YOU LEFT YOUR GAME')
  const back=page.getByRole('link',{name:'RETURN TO GAME'})
  await expect(back).toHaveAttribute('href','/room/A1B2C3D4')
  await page.evaluate(()=>document.fonts.ready)
  const hero=await page.locator('.hero-content').boundingBox(), commands=server.commands
  await expect.poll(()=>server.reads,{timeout:8000}).toBeGreaterThan(1)
  expect(server.commands).toBe(commands)
  expect(await page.locator('.hero-content').boundingBox()).toEqual(hero)
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(mode==='battle'?390:1440)
  await page.screenshot({path:testInfo.outputPath(`return-${mode}.png`)})
  await back.click()
  await expect(grid).toBeVisible();expect(await grid.textContent()).toBe(entries)
  await expect(notice).toHaveCount(0)
  expect(server.commands).toBeGreaterThan(commands)
})

test('Remembered game survives homepage reload, stays scoped to its account, and disappears when the server ends it',async({page})=>{
  const server=await fixture(page)
  await page.getByRole('link',{name:'SUDUEL home',exact:true}).first().click()
  const notice=page.getByRole('status',{name:'Return to your game'})
  await expect(notice).toBeVisible()
  await page.goto('/tests/fixtures/room-harness.html?view=room-page&start=home')
  await expect(notice).toBeVisible()
  // Fixture-only auth state replacement; no credentials/JWTs or actual sessions.
  await page.evaluate(async()=>{
    const modulePath='/src/features/auth/store.ts'
    const {useAuth}=await import(modulePath)
    useAuth.setState({session:null,loading:false})
  })
  await expect(notice).toHaveCount(0)
  await page.evaluate(async()=>{
    const modulePath='/src/features/auth/store.ts'
    const {useAuth}=await import(modulePath)
    useAuth.setState({session:{user:{id:crypto.randomUUID()}} as Session,loading:false})
  })
  await expect(notice).toHaveCount(0)
  server.status('finished')
  const reads=server.reads
  await page.goto('/tests/fixtures/room-harness.html?view=room-page&start=home')
  await expect.poll(()=>server.reads).toBeGreaterThan(reads)
  await expect(notice).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('suduel.active-game.v1'))).toBeNull()
})

for(const status of ['closed','missing'] as const)test(`A ${status} game is removed from the return reminder`,async({page})=>{
  const server=await fixture(page)
  server.status(status)
  await page.getByRole('link',{name:'SUDUEL home',exact:true}).first().click()
  await expect.poll(()=>server.reads).toBeGreaterThan(0)
  await expect(page.getByRole('status',{name:'Return to your game'})).toHaveCount(0)
  await expect.poll(()=>page.evaluate(()=>localStorage.getItem('suduel.active-game.v1'))).toBeNull()
})

test('A temporary status failure keeps the return button, and an ongoing Battle series remains returnable between rounds',async({page})=>{
  const server=await fixture(page)
  server.status('error')
  await page.getByRole('link',{name:'SUDUEL home',exact:true}).first().click()
  const notice=page.getByRole('status',{name:'Return to your game'})
  await expect(notice).toContainText('Connection interrupted.')
  await expect(page.getByRole('link',{name:'RETURN TO GAME'})).toBeVisible()
  server.status('intermission')
  await page.evaluate(()=>window.dispatchEvent(new Event('online')))
  await expect(notice).toContainText('Your match is still running.')
  server.status('finished')
  await page.evaluate(()=>window.dispatchEvent(new Event('online')))
  await expect(notice).toHaveCount(0)
})

test('An intentional forfeit clears the return reminder',async({page})=>{
  const server=await fixture(page)
  await page.getByRole('button',{name:'Leave Battle series'}).click()
  await page.getByRole('button',{name:'FORFEIT',exact:true}).click()
  await expect(page.getByText('MATCH COMPLETE / BATTLE SERIES')).toBeVisible()
  await page.getByRole('link',{name:'SUDUEL home',exact:true}).first().click()
  await expect(page.getByRole('link',{name:'RETURN TO GAME'})).toHaveCount(0)
  expect(server.reads).toBe(0)
  expect(await page.evaluate(()=>localStorage.getItem('suduel.active-game.v1'))).toBeNull()
})
