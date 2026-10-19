const base = 'http://127.0.0.1:4310'

async function call(path, body) {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return response.json()
}

const reset = await call('/api/reset')
console.log('reset:', reset.ok)

const submitted = await call('/api/farmer/submit', {
  groupName: '3组',
  vegetableName: '高山云雾茶',
  quantityKg: 5,
  harvestDate: '2026-10-18',
})
console.log('submit:', JSON.stringify(submitted))

const state = await fetch(`${base}/api/state`).then((r) => r.json())
console.log('state produce:', state.produces[0]?.groupName, state.produces[0]?.vegetableName)
console.log('audit count:', state.audit.length)
