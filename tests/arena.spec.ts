import { expect, test, type Page } from '@playwright/test'
import type { RoomSnapshot } from '../src/features/multiplayer/types'

// Authorized snapshot presentation fixtures. The SQL contracts separately validate authority.
async function roomFixture(page: Page) {
  let state: RoomSnapshot
  let response: ((s: RoomSnapshot, body: { p_command: string; p_payload: Record<string, number>; p_action_id: string }) => void) | undefined
  await page.route('**/rest/v1/rpc/suduel_command', async (route) => {
    state ??= await page.evaluate(() => (window as unknown as { __suduelFixtureSnapshot: RoomSnapshot }).__suduelFixtureSnapshot)
    const body = route.request().postDataJSON()
    delete state.action
    response?.(state, body)
    state.server_now = new Date().toISOString()
    await route.fulfill({ json: state })
  })
  await page.goto('/tests/fixtures/room-harness.html?view=room-page')
  await expect(page.getByRole('grid', { name: 'Sudoku puzzle', exact: true })).toBeVisible()
  return {
    mutate: (fn: (s: RoomSnapshot) => void) => { fn(state); state.cursor++ },
    respond: (fn: typeof response) => { response = fn },
    resync: () => page.getByRole('button', { name: 'Resync boards' }).click(),
  }
}

for (const [width,height] of [[1920,1080],[1600,900],[1440,900],[1366,768],[768,1024],[390,844]]) {
  test(`Full Battle shell keeps boards, central timer and skills visible at ${width}×${height}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width,height })
    const errors: string[]=[]; page.on('pageerror',(error) => errors.push(error.message))
    await roomFixture(page)
    const own=page.getByRole('grid',{name:'Sudoku puzzle',exact:true}), rival=page.getByRole('grid',{name:'Opponent Sudoku puzzle'})
    const clock=await page.locator('.race-clock').boundingBox()
    if(width>=740) {
      await expect(rival).toBeVisible()
      const a=await own.boundingBox(), b=await rival.boundingBox()
      expect(clock!.x).toBeGreaterThan(a!.x+a!.width)
      expect(clock!.x+clock!.width).toBeLessThan(b!.x)
      expect(Math.abs(a!.width-b!.width)).toBeLessThan(1)
      expect(a!.width).toBeGreaterThan(width>=1300?300:230)
    } else {
      await expect(rival).toBeHidden()
      await page.getByRole('button',{name:/RIVAL GRID/}).click(); await expect(rival).toBeVisible(); await expect(own).toBeHidden()
      await page.getByRole('button',{name:/YOUR GRID/}).click()
    }
    for(const skill of ['fog','freeze','scramble','shield']) {
      const box=await page.getByRole('button',{name:new RegExp(`^Cast ${skill}\\.`)}).boundingBox()
      expect(box!.y).toBeGreaterThan(0); expect(box!.y+box!.height).toBeLessThanOrEqual(height)
    }
    expect(clock!.y).toBeGreaterThan(0); expect(clock!.y+clock!.height).toBeLessThan(height)
    expect(await page.evaluate(() => ({width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight}))).toEqual({width,height})
    await page.evaluate(() => document.fonts.ready)
    await page.screenshot({path:testInfo.outputPath(`arena-${width}-${height}.png`)})
    expect(errors).toEqual([])
  })
}

test('Actual remote entries, erases and redacted Fog recover without granting edit controls', async ({page}) => {
  const server=await roomFixture(page)
  const own=page.getByRole('grid',{name:'Sudoku puzzle',exact:true}), rival=page.getByRole('grid',{name:'Opponent Sudoku puzzle'})
  await expect(rival).toHaveAttribute('aria-readonly','true'); await expect(rival.getByRole('button')).toHaveCount(0)
  const original=await own.textContent()
  server.mutate((s) => { const b=s.battle!.boards![1]; b.entries[0]=2; b.version++ })
  await server.resync(); await expect(rival.getByRole('gridcell').nth(0)).toContainText('2')
  await expect(rival.getByRole('gridcell').nth(0)).toHaveAccessibleName(/confirmed entry/)
  expect(await own.textContent()).toBe(original)
  await rival.getByRole('gridcell').nth(0).click(); await page.keyboard.press('8')
  await expect(rival.getByRole('gridcell').nth(0)).toContainText('2')
  server.mutate((s) => { const b=s.battle!.boards![1]; b.entries[0]=0; b.version++ })
  await server.resync(); await expect(rival.getByRole('gridcell').nth(0)).toBeEmpty()
  server.mutate((s) => { const b=s.battle!.boards![1]; b.redacted_cells=[0,1,2,9,10,11,18,19,20]; b.redacted_cells.forEach((i)=>b.entries[i]=null) })
  await server.resync(); await expect(rival.getByRole('gridcell',{name:/concealed by Fog/})).toHaveCount(9)
  await page.reload(); await expect(rival.getByRole('gridcell',{name:/concealed by Fog/})).toHaveCount(9)
  expect(await own.textContent()).toBe(original)
})

test('Confirmed mistakes preserve entries, recover input, pulse pressure, transfer energy and survive reload', async ({page}) => {
  const server=await roomFixture(page)
  const grid=page.getByRole('grid',{name:'Sudoku puzzle',exact:true}), pressure=page.getByRole('meter',{name:'Your mistake pressure'})
  server.mutate((s)=> { s.battle!.players[1].energy=0 })
  server.respond((s,body)=> {
    if(body.p_command!=='move')return
    const player=s.battle!.players[0], target=s.battle!.players[1]
    player.genuine_mistakes++; player.mistake_pressure=player.genuine_mistakes%3; player.input_recovery_until=new Date(Date.now()+500).toISOString()
    const broken=player.mistake_pressure===0
    if(broken){player.pressure_rewards++;target.energy++;target.version++}
    s.cursor++; s.action={id:body.p_action_id,cell:body.p_payload.cell,rejected:true,counted:true,message:'Incorrect number. Recovering for 0.5 seconds.'}
    s.events!.push({sequence:s.cursor,match_id:s.match!.id,kind:'mistake_pressure',created_at:new Date().toISOString(),payload:{actor_id:player.user_id,target_id:target.user_id,action_id:body.p_action_id,pressure:player.mistake_pressure,genuine_mistakes:player.genuine_mistakes,break:broken,generated:broken?1:0,stored:broken?1:0}})
  })
  const original=await grid.textContent()
  const initialBounds=await grid.boundingBox()
  for(let i=0;i<3;i++) {
    await grid.getByRole('button').nth(i*3).click(); await page.keyboard.press('9')
    await expect(grid).toHaveAttribute('aria-disabled','true')
    await expect(grid.locator('.invalid')).toHaveCount(1)
    expect(await grid.textContent()).toBe(original)
    await expect(page.getByRole('alert')).toHaveCount(0)
    expect(await grid.boundingBox()).toEqual(initialBounds)
    if(i<2)await expect(pressure).toHaveAttribute('aria-valuenow',String(i+1))
    if(i===1)await expect(pressure).toHaveClass(/pressure-near/)
    if(i===2){
      await expect(page.locator('.battle-announcements')).toContainText('MISTAKE ×3')
      await expect(page.locator('.battle-announcements')).toContainText('OPPONENT +1 ENERGY')
      await expect(page.locator('.pressure-transfer.to-rival')).toHaveCount(1)
      await expect(page.getByLabel('Rival energy')).toContainText('1 / 5')
      await expect(page.getByRole('region',{name:'Live battle feed'})).toContainText('+1 ENERGY')
    }
    await expect(grid).toHaveAttribute('aria-disabled','false')
  }
  await page.reload(); await expect(pressure).toHaveAttribute('aria-valuenow','0'); await expect(pressure).toHaveAttribute('aria-valuetext',/1 of 2 bonuses/)
  await expect(page.getByLabel('Rival energy')).toContainText('1 / 5'); await expect(page.locator('.pressure-transfer.to-rival')).toHaveCount(0)
})

test('Board Scramble maps both actual grids, input, notes and reconnect without changing keypad order', async ({page}) => {
  const server=await roomFixture(page)
  const own=page.getByRole('grid',{name:'Sudoku puzzle',exact:true}), rival=page.getByRole('grid',{name:'Opponent Sudoku puzzle'})
  server.respond((s,body)=> {
    if(body.p_command!=='move')return
    s.board!.entries[body.p_payload.cell]=body.p_payload.digit; s.board!.version++
    s.battle!.boards![0].entries=[...s.board!.entries];s.battle!.boards![0].version=s.board!.version
    s.action={id:body.p_action_id,cell:body.p_payload.cell};s.cursor++
  })
  server.mutate((s)=> {
    const own=s.players[0].user_id, other=s.players[1].user_id
    s.battle!.effects=[own,other].map((target_id,i)=>({id:crypto.randomUUID(),match_id:s.match!.id,source_id:i?own:other,target_id,skill:'scramble',starts_at:new Date().toISOString(),expires_at:new Date(Date.now()+8000).toISOString(),consumed_at:null,region:null,keypad:i?[9,1,2,3,4,5,6,7,8]:[2,3,4,5,6,7,8,9,1]}))
    s.battle!.boards![1].entries[0]=2
  })
  await server.resync()
  await expect(own.getByRole('button').nth(1)).toHaveText('3')
  await expect(rival.getByRole('gridcell').nth(1)).toHaveText('2')
  await expect(rival.getByRole('gridcell').nth(0)).toHaveText('1')
  expect(await page.locator('.number-pad button').allTextContents()).toEqual(['1','2','3','4','5','6','7','8','9'])
  await page.getByRole('button',{name:'Enter 2',exact:true}).click()
  await expect(own.getByRole('button').nth(0)).toHaveText('2')
  await expect(page.getByRole('meter',{name:'Your mistake pressure'})).toHaveAttribute('aria-valuenow','0')
  await own.getByRole('button').nth(0).focus(); await page.keyboard.press('Delete')
  await expect(own.getByRole('button').nth(0)).toBeEmpty()
  await page.keyboard.press('2'); await expect(own.getByRole('button').nth(0)).toHaveText('2')
  await page.reload(); await expect(own.getByRole('button').nth(0)).toHaveText('2')
  await expect(rival.getByRole('gridcell').nth(0)).toHaveText('1')
  await expect(rival.getByRole('button')).toHaveCount(0)
  await own.getByRole('button').nth(3).focus(); await page.keyboard.press('n');await page.keyboard.press('4')
  await expect(own.getByRole('button').nth(3)).toHaveAccessibleName(/notes 4/)
  server.mutate((s)=>{s.battle!.effects=[]}); await server.resync()
  await expect(own.getByRole('button').nth(0)).toHaveText('1')
  await expect(own.getByRole('button').nth(1)).toHaveText('2')
  await expect(own.getByRole('button').nth(3)).toHaveAccessibleName(/notes 3/)
  await expect(rival.getByRole('gridcell').nth(0)).toHaveText('2')
})

test('Scramble costs four energy and Shield costs five in the skill dock', async ({page}) => {
  const server=await roomFixture(page)
  const scramble=page.getByRole('button',{name:/^Cast scramble\. 4 energy/}), shield=page.getByRole('button',{name:/^Cast shield\. 5 energy/})
  server.mutate((s)=>{s.battle!.players[0].energy=3}); await server.resync()
  await expect(scramble).toBeDisabled(); await expect(shield).toBeDisabled()
  server.mutate((s)=>{s.battle!.players[0].energy=4}); await server.resync()
  await expect(scramble).toBeEnabled(); await expect(shield).toBeDisabled()
  server.mutate((s)=>{s.battle!.players[0].energy=5}); await server.resync()
  await expect(shield).toBeEnabled()
})

test('Reduced motion preserves readable pressure and compact view retains timer and dock', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'})
  await page.setViewportSize({width:390,height:600})
  const server=await roomFixture(page)
  server.mutate((s)=>{s.battle!.players[0].mistake_pressure=2;s.battle!.players[0].genuine_mistakes=2})
  await server.resync()
  await expect(page.locator('.pressure-near .pressure-segments')).toHaveCSS('animation-name','none')
  await expect(page.locator('.compact-arena-notice')).toBeVisible()
  const timer=await page.locator('.race-clock').boundingBox(), dock=await page.getByRole('region',{name:'Battle skills'}).boundingBox()
  expect(timer!.y).toBeGreaterThan(0);expect(dock!.y+dock!.height).toBeLessThanOrEqual(600)
  expect(await page.evaluate(()=>document.documentElement.scrollHeight)).toBe(600)
})
