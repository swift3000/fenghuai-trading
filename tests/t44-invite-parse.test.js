global.getApp = () => ({ globalData: {}, updateTabBarByRole() {} })
global.wx = { showToast(){}, setStorageSync(){}, getStorageSync(){}, reLaunch(){}, switchTab(){} }
let pageDef
global.Page = (def) => { pageDef = def }
require('/Users/god/Desktop/项目/github/fenghuai-trading/pages/login/login.js')
const ctx = Object.assign({}, pageDef, { data: {}, setData(p){ Object.assign(ctx.data, p) } })
function check(name, options, expected) {
  ctx.data = {}
  ctx.parseInviteFromOptions(options)
  const got = ctx.data.inviteCode
  console.log(name + ':', got === expected ? 'PASS' : 'FAIL got=' + got + ' want=' + expected)
}
check('card', { invite: 'ABC123' }, 'ABC123')
check('scene', { scene: encodeURIComponent('invite=DEF456') }, 'DEF456')
check('none', {}, undefined)
check('lower', { invite: 'abc123' }, 'ABC123')
check('invalid', { invite: '!!' }, undefined)

