const { guardPageLoad } = require('../../utils/router-guard')
const { callCloud, callCloudRaw } = require('../../utils/request')

// 默认商品数据（180 个）
const DEFAULT_PRODUCTS = [
  {material_code:'1', name:"海藻碘", spec:'1×60', pricing_mode:'case', unit_piece_qty:60, price_piece:45, price_unit:0.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'2', name:"淮盐400g", spec:'1×50', pricing_mode:'case', unit_piece_qty:50, price_piece:36, price_unit:0.72, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'3', name:"淮盐500g", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:70, price_unit:1.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'4', name:"吾宠湾粥", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:45, price_unit:1.125, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'5', name:"老酸奶", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:45, price_unit:1.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'6', name:"西安小包包子", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:41, price_unit:0.41, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'7', name:"鲜爽果汁", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:38, price_unit:1.266667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'8', name:"400克晶纯盐", spec:'1×50', pricing_mode:'case', unit_piece_qty:50, price_piece:25, price_unit:0.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'9', name:"45微粮粥", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:45, price_unit:1.125, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'10', name:"50秒三秒粥", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:50, price_unit:1.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'11', name:"有情郎米酒", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:33, price_unit:1.1, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'12', name:"有情郎奶茶", spec:'1×24', pricing_mode:'case', unit_piece_qty:24, price_piece:48, price_unit:2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'13', name:"有情郎豆奶、绿豆沙", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:38, price_unit:1.266667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'14', name:"永和豆浆", spec:'1×60', pricing_mode:'case', unit_piece_qty:60, price_piece:72, price_unit:1.2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'15', name:"欣朵朵布丁", spec:'1×24', pricing_mode:'case', unit_piece_qty:24, price_piece:30, price_unit:1.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'16', name:"久念麻球", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:80, price_unit:20, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'17', name:"乡道糖糕", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:70, price_unit:17.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'18', name:"怀念菜角", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:85, price_unit:14.166667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'19', name:"爆珠果奶", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:55, price_unit:1.833333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'20', name:"酥饼（纸箱装）", spec:'1×50', pricing_mode:'case', unit_piece_qty:50, price_piece:55, price_unit:1.1, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'21', name:"100个小蒸饺", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:30, price_unit:0.3, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'22', name:"玉米粑粑", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:90, price_unit:22.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'23', name:"小笼包子", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:41, price_unit:0.41, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'24', name:"心思源蒸饺", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:110, price_unit:11, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'25', name:"食自在蒸饺", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:85, price_unit:8.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'26', name:"曹氏箱水饺", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:80, price_unit:20, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'27', name:"鲜沫豆浆", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:48, price_unit:1.2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'28', name:"早餐伴侣", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:36, price_unit:1.2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'29', name:"糯玉米", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:85, price_unit:2.125, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'30', name:"心思源70克烧麦", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:140, price_unit:14, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'31', name:"彭幺妹4包发糕", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:96, price_unit:24, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'32', name:"今巴4包发糕", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:80, price_unit:20, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'33', name:"良邦卡通包", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:115, price_unit:28.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'34', name:"今巴方糕", spec:'1×15', pricing_mode:'case', unit_piece_qty:15, price_piece:110, price_unit:7.333333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'35', name:"良邦组合装卡包", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:75, price_unit:7.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'36', name:"125潼关饼", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:125, price_unit:20.833333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'37', name:"今巴窝窝头", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:96, price_unit:9.6, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'38', name:"苹果包+果蔬包", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:70, price_unit:7, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'39', name:"烧麦彭幺妹5包", spec:'1×5', pricing_mode:'case', unit_piece_qty:5, price_piece:115, price_unit:23, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'40', name:"六合鸡胸肉", spec:'1×1', pricing_mode:'piece', unit_piece_qty:1, price_piece:100, price_unit:null, unit:'件', pinyin:'', is_adjustable:false},
  {material_code:'41', name:"130老潼关", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:130, price_unit:21.666667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'42', name:"150潼关饼", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:120, price_unit:20, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'43', name:"食自在大锅贴", spec:'1×8', pricing_mode:'case', unit_piece_qty:8, price_piece:90, price_unit:11.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'44', name:"鸡全架", spec:'1×1', pricing_mode:'piece', unit_piece_qty:1, price_piece:50, price_unit:null, unit:'件', pinyin:'', is_adjustable:false},
  {material_code:'45', name:"手抓饼", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:85, price_unit:0.85, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'46', name:"葱油饼", spec:'1×12', pricing_mode:'case', unit_piece_qty:12, price_piece:130, price_unit:10.833333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'47', name:"热狗玉米紫薯酸奶", spec:'1×16', pricing_mode:'case', unit_piece_qty:16, price_piece:110, price_unit:6.875, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'48', name:"心思源50克烧麦", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:100, price_unit:10, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'49', name:"千味烧麦", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:120, price_unit:12, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'50', name:"粉色抽纸", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:75, price_unit:0.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'51', name:"汉纯纸", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:70, price_unit:0.7, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'52', name:"80克大包子", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:95, price_unit:9.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'53', name:"夫宇麦穗肠", spec:'1×8', pricing_mode:'case', unit_piece_qty:8, price_piece:120, price_unit:15, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'54', name:"峰仔樱花糕", spec:'1×15', pricing_mode:'case', unit_piece_qty:15, price_piece:103, price_unit:6.866667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'55', name:"85抽纸", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:80, price_unit:0.8, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'56', name:"黄金小酥饼", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:35, price_unit:1.166667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'57', name:"笑脸牛肉馅饼", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:110, price_unit:18.333333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'58', name:"金刚鸡排", spec:'1×5', pricing_mode:'case', unit_piece_qty:5, price_piece:150, price_unit:30, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'59', name:"大件筷子", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:190, price_unit:31.666667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'60', name:"5.0熊猫筷子840", spec:'1×1', pricing_mode:'piece', unit_piece_qty:1, price_piece:32, price_unit:null, unit:'件', pinyin:'', is_adjustable:false},
  {material_code:'61', name:"75黄色120包抽纸", spec:'1×1', pricing_mode:'piece', unit_piece_qty:1, price_piece:70, price_unit:null, unit:'件', pinyin:'', is_adjustable:false},
  {material_code:'62', name:"5.5熊猫筷子900", spec:'1×1', pricing_mode:'piece', unit_piece_qty:1, price_piece:40, price_unit:null, unit:'件', pinyin:'', is_adjustable:false},
  {material_code:'65', name:"西安手工大包子", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:174, price_unit:29, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'66', name:"360彩杯", spec:'1×2000', pricing_mode:'case', unit_piece_qty:2000, price_piece:120, price_unit:0.06, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'67', name:"400彩杯", spec:'1×2000', pricing_mode:'case', unit_piece_qty:2000, price_piece:125, price_unit:0.0625, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'68', name:"450彩杯", spec:'1×2000', pricing_mode:'case', unit_piece_qty:2000, price_piece:135, price_unit:0.0675, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'70', name:"大彩碗", spec:'1×600', pricing_mode:'case', unit_piece_qty:600, price_piece:80, price_unit:0.133333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'71', name:"一号纸碗", spec:'1×450', pricing_mode:'case', unit_piece_qty:450, price_piece:45, price_unit:0.1, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'72', name:"小件抽纸", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:43, price_unit:43, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'73', name:"新品绿抽", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:68, price_unit:0.68, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'74', name:"鸡柳", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:130, price_unit:13, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'75', name:"清源口杯", spec:'1×28', pricing_mode:'case', unit_piece_qty:28, price_piece:65, price_unit:2.321429, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'76', name:"稀饭杯（三元）", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:75, price_unit:3.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'77', name:"兢农玉米", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:95, price_unit:2.375, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'78', name:"A-3餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:40, price_unit:0.133333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'79', name:"大稀饭吸管", spec:'1×50', pricing_mode:'case', unit_piece_qty:50, price_piece:45, price_unit:0.9, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'80', name:"豆浆吸管", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:75, price_unit:2.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'81', name:"封口膜", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:40, price_unit:40, unit:'卷', pinyin:'', is_adjustable:false},
  {material_code:'82', name:"12A豆浆杯", spec:'1×40', pricing_mode:'case', unit_piece_qty:40, price_piece:190, price_unit:4.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'84', name:"大白勺子", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:65, price_unit:3.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'85', name:"透明勺子103", spec:'1×1', pricing_mode:'piece', unit_piece_qty:1, price_piece:50, price_unit:null, unit:'件', pinyin:'', is_adjustable:false},
  {material_code:'86', name:"一次性手套", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:40, price_unit:2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'87', name:"清洁球", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:5, price_unit:0.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'88', name:"洗洁精25KG", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:50, price_unit:50, unit:'桶', pinyin:'', is_adjustable:false},
  {material_code:'89', name:"空桶、洗洁精 50斤", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:10, price_unit:10, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'93', name:"调货", spec:'1×1', pricing_mode:'unit', unit_piece_qty:1, price_piece:null, price_unit:0, unit:'包', pinyin:'', is_adjustable:true},
  {material_code:'100', name:"P4餐盒", spec:'1×1000', pricing_mode:'case', unit_piece_qty:1000, price_piece:90, price_unit:0.09, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'101', name:"300圆餐盒", spec:'1×450', pricing_mode:'case', unit_piece_qty:450, price_piece:70, price_unit:0.155556, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'102', name:"450圆餐盒", spec:'1×450', pricing_mode:'case', unit_piece_qty:450, price_piece:75, price_unit:0.166667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'103', name:"500圆餐盒", spec:'1×450', pricing_mode:'case', unit_piece_qty:450, price_piece:80, price_unit:0.177778, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'104', name:"625圆餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:70, price_unit:0.233333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'105', name:"分体四格", spec:'1×150', pricing_mode:'case', unit_piece_qty:150, price_piece:100, price_unit:0.666667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'106', name:"750圆餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:70, price_unit:0.233333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'107', name:"800圆餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:75, price_unit:0.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'108', name:"1000圆餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:70, price_unit:0.233333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'109', name:"1250圆餐盒", spec:'1×200', pricing_mode:'case', unit_piece_qty:200, price_piece:70, price_unit:0.35, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'110', name:"1500圆餐盒", spec:'1×200', pricing_mode:'case', unit_piece_qty:200, price_piece:80, price_unit:0.4, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'111', name:"1750圆餐盒", spec:'1×200', pricing_mode:'case', unit_piece_qty:200, price_piece:90, price_unit:0.45, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'112', name:"3000盆", spec:'1×90', pricing_mode:'case', unit_piece_qty:90, price_piece:90, price_unit:1, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'113', name:"3500盆", spec:'1×90', pricing_mode:'case', unit_piece_qty:90, price_piece:90, price_unit:1, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'114', name:"4000盆", spec:'1×60', pricing_mode:'case', unit_piece_qty:60, price_piece:110, price_unit:1.833333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'115', name:"4800盆", spec:'1×60', pricing_mode:'case', unit_piece_qty:60, price_piece:110, price_unit:1.833333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'116', name:"500方餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:65, price_unit:0.216667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'117', name:"650方餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:70, price_unit:0.233333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'118', name:"750方餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:70, price_unit:0.233333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'119', name:"1000方餐盒", spec:'1×300', pricing_mode:'case', unit_piece_qty:300, price_piece:75, price_unit:0.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'120', name:"鸡腿堡+鸡肉卷", spec:'1×60', pricing_mode:'case', unit_piece_qty:60, price_piece:145, price_unit:2.416667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'121', name:"纸杯", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:125, price_unit:125, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'122', name:"明途包子", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:180, price_unit:30, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'123', name:"安蜀手撕馒头", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:63, price_unit:6.3, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'124', name:"汉堡胚", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:80, price_unit:80, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'125', name:"手工烙饼", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:130, price_unit:21.666667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'126', name:"木鱼（双色糕）", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:80, price_unit:4, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'127', name:"秦迈馄饨", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:112, price_unit:5.6, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'128', name:"紫薯+南瓜开花馒头", spec:'1×15', pricing_mode:'case', unit_piece_qty:15, price_piece:95, price_unit:6.333333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'129', name:"金丝藤椒鸡排", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:140, price_unit:14, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'130', name:"雍运肉夹馍", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:85, price_unit:14.166667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'131', name:"木鱼红糖发糕", spec:'1×16', pricing_mode:'case', unit_piece_qty:16, price_piece:70, price_unit:4.375, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'132', name:"牛舌饼-小馋童", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:100, price_unit:16.666667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'133', name:"安井50克烧麦", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:85, price_unit:21.25, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'134', name:"110潼关饼", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:110, price_unit:18.333333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'135', name:"鸡蛋灌饼", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:90, price_unit:22.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'136', name:"小馋童金丝卷", spec:'1×12', pricing_mode:'case', unit_piece_qty:12, price_piece:105, price_unit:8.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'137', name:"千味寻小笼包", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:170, price_unit:28.333333, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'138', name:"保鲜膜", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:200, price_unit:200, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'139', name:"思念水饺(韭菜鸡蛋)", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:90, price_unit:22.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'140', name:"38克烤肠", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:200, price_unit:20, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'141', name:"绿秦20斤卤肉", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:370, price_unit:18.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'142', name:"汉堡肉", spec:'1×15', pricing_mode:'case', unit_piece_qty:15, price_piece:165, price_unit:11, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'143', name:"白吉馍", spec:'1×12', pricing_mode:'case', unit_piece_qty:12, price_piece:110, price_unit:9.166667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'144', name:"邦杰-手工水饺", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:110, price_unit:27.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'145', name:"心思源玉米饼", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:110, price_unit:11, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'146', name:"马蹄酥", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:75, price_unit:3.75, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'147', name:"手工烧饼", spec:'1×50', pricing_mode:'case', unit_piece_qty:50, price_piece:60, price_unit:1.2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'148', name:"鸡胗", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:180, price_unit:18, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'149', name:"冻鸭", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:120, price_unit:120, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'150', name:"久念100g油条", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:100, price_unit:10, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'151', name:"70克火山石烤肉肠", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:320, price_unit:32, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'152', name:"久念80g油条", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:85, price_unit:8.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'153', name:"雍运照烧馅饼", spec:'1×12', pricing_mode:'case', unit_piece_qty:12, price_piece:170, price_unit:14.166667, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'154', name:"鸡翅根", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:150, price_unit:37.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'155', name:"金牧1315鸡腿", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:145, price_unit:145, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'156', name:"70克烤肉肠", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:280, price_unit:28, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'157', name:"良邦-哪吒包", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:80, price_unit:8, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'158', name:"立白洗洁精", spec:'1×6', pricing_mode:'case', unit_piece_qty:6, price_piece:90, price_unit:15, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'159', name:"标点牛肉花卷", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:100, price_unit:10, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'160', name:"20白袋子", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:200, price_unit:200, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'161', name:"24白袋子", spec:'1×100', pricing_mode:'case', unit_piece_qty:100, price_piece:300, price_unit:3, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'162', name:"30白袋子", spec:'1×1', pricing_mode:'case', unit_piece_qty:1, price_piece:210, price_unit:210, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'163', name:"博大1518琵琶腿", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:120, price_unit:6, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'164', name:"龙利鱼", spec:'1×4', pricing_mode:'case', unit_piece_qty:4, price_piece:200, price_unit:50, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'165', name:"思念小云吞", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:90, price_unit:4.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'166', name:"安井锅包肉", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:145, price_unit:14.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'167', name:"安井茄盒", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:120, price_unit:12, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'168', name:"易太蚝油肉片", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:150, price_unit:15, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'169', name:"青豆", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:85, price_unit:8.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'170', name:"甜玉米粒", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:90, price_unit:9, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'171', name:"安井耦盒", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:110, price_unit:11, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'172', name:"安井千叶豆腐", spec:'1×30', pricing_mode:'case', unit_piece_qty:30, price_piece:135, price_unit:4.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'173', name:"安井小酥肉", spec:'1×8', pricing_mode:'case', unit_piece_qty:8, price_piece:165, price_unit:20.625, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'174', name:"安井香酥带鱼", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:180, price_unit:18, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'175', name:"安井干炸里脊", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:145, price_unit:14.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'176', name:"双椒油黄鸡", spec:'1×20', pricing_mode:'case', unit_piece_qty:20, price_piece:190, price_unit:9.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'177', name:"学子膳-小炒肉丝", spec:'1×10', pricing_mode:'case', unit_piece_qty:10, price_piece:145, price_unit:14.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'178', name:"易太黑椒牛柳", spec:'1×25', pricing_mode:'case', unit_piece_qty:25, price_piece:330, price_unit:13.2, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'179', name:"辣子鸡", spec:'1×8', pricing_mode:'case', unit_piece_qty:8, price_piece:140, price_unit:17.5, unit:'包', pinyin:'', is_adjustable:false},
  {material_code:'180', name:"易太蚝油牛柳", spec:'1×25', pricing_mode:'case', unit_piece_qty:25, price_piece:340, price_unit:13.6, unit:'包', pinyin:'', is_adjustable:false},
]

const uiStyle = require('../../utils/ui-style')
Page({
  data: {
    categoryFilter: 'all',
    sortOrder: 'asc',
    debounceTimer: null,
    isSearching: false,
    uiStyle: '',
    searchKeyword: '',
    products: [],
    canEdit: false,
  isAdmin: false,
    showForm: false,
    showImportDialog: false,
    showPriceModal: false,
    priceItem: null,
    priceMode: 'case',
    priceForm: { pricePiece: '', priceUnit: '' },
    savingPrice: false,
    editingProduct: null,
    saving: false,
    importing: false,
    importOverride: true,
    defaultProductsCount: DEFAULT_PRODUCTS.length,
    formData: {
      name: '',
      materialCode: '',
      spec: '',
      unit: '包',
      pricePiece: '',
      priceUnit: '',
      pricingMode: 'case',
      isAdjustable: false
    },
    modeOptions: ['case', 'piece', 'unit'],
    modeIndex: 0,
    unitOptions: ['件', '包'],
    unitIndex: 0
  },

  onLoad() {
    if (!guardPageLoad(this)) {
      return
    }
    const app = getApp()
const perms = (app.globalData.userInfo && app.globalData.userInfo.permissions) || []
    this.setData({ canEdit: perms.includes('product:edit') })
    this.setData({ isAdmin: (app.globalData.userInfo && app.globalData.userInfo.role === "admin") || false })
  },

  onShow() {
    uiStyle.applyUiStyle(this)
    this.loadProducts()
  },

  onSearch(e) {
    const keyword = e.detail.value || ''
    
    // 清除之前的定时器
    if (this.data.debounceTimer) {
      clearTimeout(this.data.debounceTimer)
    }
    
    // 设置新的防抖定时器（300ms）
    const timer = setTimeout(() => {
      this.setData({ searchKeyword: keyword })
      this.loadProducts()
    }, 300)
    
    this.setData({ debounceTimer: timer })
  },

  async loadProducts() {
    if (this.data.isSearching) return
    
    this.setData({ isSearching: true })
    wx.showLoading({ title: '加载中...' })
    try {
      console.log('🔍 开始加载商品数据...')
      const res = await callCloud('products', {
        action: 'list',
        searchKey: this.data.searchKeyword
      })
      console.log('✅ 商品数据加载成功:', res ? res.length : 0, '条')
      this.setData({ products: this.decorateProducts(res || []) })
    } catch (e) {
      console.error('❌ 加载商品失败:', e)
      console.error('错误详情:', JSON.stringify(e))
      wx.showToast({ title: '加载失败：' + (e.message || '未知错误'), icon: 'none', duration: 3000 })
      // 降级：显示默认商品
      console.log('📦 使用默认商品数据')
      this.setData({ products: this.decorateProducts(DEFAULT_PRODUCTS) })
    } finally {
      wx.hideLoading()
      this.setData({ isSearching: false })
    }
  },

  decorateProducts(list) {
    return (list || []).map(it => {
      const mode = it.pricing_mode || 'case'
      const base = (it.unit || '').split('/')[0] || '包'
      let priceMain = '', priceSub = ''
      if (mode === 'case' && it.price_piece != null) {
        priceMain = '¥' + it.price_piece
        priceSub = it.price_unit != null ? '售价 · ' + it.price_unit + '/' + base : '售价'
      } else if (mode === 'piece' && it.price_piece != null) {
        priceMain = '¥' + it.price_piece
        priceSub = '售价'
      } else if (mode === 'unit' && it.price_unit != null) {
        priceMain = '¥' + it.price_unit
        priceSub = '售价/' + base
      } else {
        priceMain = '—'
        priceSub = '下单时自填'
      }
      return Object.assign({}, it, { priceMain, priceSub })
    })
  },

  openPriceModal(e) {
    const item = e.currentTarget.dataset.item
    const mode = item.pricing_mode || 'case'
    this.setData({
      showPriceModal: true,
      priceItem: item,
      priceMode: mode,
      priceForm: {
        pricePiece: item.price_piece != null ? String(item.price_piece) : '',
        priceUnit: item.price_unit != null ? String(item.price_unit) : ''
      }
    })
  },

  closePriceModal() {
    this.setData({ showPriceModal: false })
  },

  onPriceInput(e) {
    const field = e.currentTarget.dataset.field
    this.setData({ ['priceForm.' + field]: e.detail.value })
  },

  async savePrice() {
    const { priceItem, priceMode, priceForm } = this.data
    if (!priceItem) return
    let pp = null, pz = null
    if (priceMode === 'case') {
      pp = parseFloat(priceForm.pricePiece)
      pz = priceForm.priceUnit === '' ? 0 : parseFloat(priceForm.priceUnit)
      if (isNaN(pp) || pp < 0) { wx.showToast({ title: '件价不能为空或负数', icon: 'none' }); return }
      if (pz == null || isNaN(pz) || pz < 0) pz = 0
    } else if (priceMode === 'piece') {
      pp = parseFloat(priceForm.pricePiece)
      if (isNaN(pp) || pp < 0) { wx.showToast({ title: '件价不能为空或负数', icon: 'none' }); return }
    } else if (priceMode === 'unit') {
      pz = parseFloat(priceForm.priceUnit)
      if (isNaN(pz) || pz < 0) { wx.showToast({ title: '单价不能为空或负数', icon: 'none' }); return }
    }
    this.setData({ savingPrice: true })
    try {
      await callCloud('products', {
        action: 'update',
        productId: priceItem._id,
        price_piece: pp,
        price_unit: pz
      })
      wx.showToast({ title: priceItem.name + ' 价格已更新' })
      this.setData({ showPriceModal: false })
      this.loadProducts()
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      this.setData({ savingPrice: false })
    }
  },

  goToAdd() {
    this.setData({
      showForm: true,
      editingProduct: null,
      formData: {
        name: '',
        materialCode: '',
        spec: '',
        unit: '包',
        pricePiece: '',
        priceUnit: '',
        pricingMode: 'case',
        isAdjustable: false
      },
      unitIndex: 0,
      modeIndex: 0
    })
  },

  goEdit(e) {
    const item = e.currentTarget.dataset.item
    const unitIndex = this.data.unitOptions.indexOf(item.unit) >= 0 ? this.data.unitOptions.indexOf(item.unit) : 0
    const modeIndex = this.data.modeOptions.indexOf(item.pricing_mode) >= 0 ? this.data.modeOptions.indexOf(item.pricing_mode) : 0
    const pp = item.price_piece !== null && item.price_piece !== undefined ? String(item.price_piece) : ''
    const pz = item.price_unit !== null && item.price_unit !== undefined ? String(item.price_unit) : (item.price_unit != null ? String(item.price_unit) : '')
    
    this.setData({
      showForm: true,
      editingProduct: item,
      formData: {
        name: item.name || '',
        materialCode: item.material_code || '',
        spec: item.spec || '',
        unit: item.unit || '包',
        pricePiece: pp,
        priceUnit: pz,
        pricingMode: item.pricing_mode || 'case',
        isAdjustable: !!item.is_adjustable
      },
      unitIndex,
      modeIndex
    })
  },

  async onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复',
      success: async res => {
        if (res.confirm) {
          try {
            wx.showLoading({ title: '删除中...' })
            await callCloud('products', { action: 'delete', productId: id })
            wx.showToast({ title: '已删除' })
            this.loadProducts()
          } catch (e) {
            wx.showToast({ title: '删除失败', icon: 'none' })
          } finally {
            wx.hideLoading()
          }
        }
      }
    })
  },

  onInputChange(e) {
    const field = e.currentTarget.dataset.field
    const value = e.detail.value
    this.setData({
      [`formData.${field}`]: value
    })
  },

  closeForm() {
    this.setData({
      showForm: false,
      editingProduct: null
    })
  },

  async saveProduct() {
    const { formData, editingProduct } = this.data
    
    // 表单验证
    if (!formData.name) {
      wx.showToast({ title: '请输入商品名称', icon: 'none' })
      return
    }
    if (!formData.materialCode) {
      wx.showToast({ title: '请输入料号', icon: 'none' })
      return
    }
    if (!formData.unit) {
      wx.showToast({ title: '请选择单位', icon: 'none' })
      return
    }
    const mode = formData.pricingMode

    // 根据计价方式校验必填价格
    const needPiece = mode !== 'unit'
    const needZero = mode !== 'piece'
    if (needPiece && (formData.pricePiece === '' || isNaN(parseFloat(formData.pricePiece)) || parseFloat(formData.pricePiece) < 0)) {
      wx.showToast({ title: '请输入有效的件价', icon: 'none' })
      return
    }
    if (needZero && (formData.priceUnit === '' || isNaN(parseFloat(formData.priceUnit)) || parseFloat(formData.priceUnit) < 0)) {
      wx.showToast({ title: '请输入有效的包价', icon: 'none' })
      return
    }

    // 从规格解析件内数量（如 1×60 → 60）
    let unitPieceQty = 1
    const m = (formData.spec || '').match(/×(\d+)/)
    if (m) unitPieceQty = parseInt(m[1], 10)

    const productData = {
      name: formData.name,
      material_code: formData.materialCode,
      spec: formData.spec,
      pinyin: '',
      unit: formData.unit,
      price_piece: needPiece ? parseFloat(formData.pricePiece) : null,
      price_unit: needZero ? parseFloat(formData.priceUnit) : null,
      unit_piece_qty: unitPieceQty,
      pricing_mode: mode,
      is_adjustable: !!formData.isAdjustable
    }

    try {
      this.setData({ saving: true })
      wx.showLoading({ title: editingProduct ? '更新中...' : '创建中...' })
      
      if (editingProduct) {
        // 更新
        await callCloud('products', {
          action: 'update',
          productId: editingProduct._id,
          ...productData
        })
        wx.showToast({ title: '更新成功' })
      } else {
        // 创建
        await callCloud('products', {
          action: 'create',
          ...productData
        })
        wx.showToast({ title: '创建成功' })
      }
      
      this.setData({ showForm: false, saving: false })
      this.loadProducts()
    } catch (e) {
      wx.showToast({ title: '保存失败', icon: 'none' })
      this.setData({ saving: false })
    } finally {
      wx.hideLoading()
    }
  },

  onModeChange(e) {
    const index = e.detail.value
    const mode = this.data.modeOptions[index]
    this.setData({
      modeIndex: index,
      [`formData.pricingMode`]: mode
    })
  },

  onUnitChange(e) {
    const index = e.detail.value
    const unit = this.data.unitOptions[index]
    this.setData({
      unitIndex: index,
      [`formData.unit`]: unit
    })
  },

  onAdjustableChange(e) {
    this.setData({ [`formData.isAdjustable`]: e.detail.value })
  },

  // 导入相关方法
  showImportDialog() {
    this.setData({ showImportDialog: true })
  },

  hideImportDialog() {
    this.setData({ showImportDialog: false })
  },

  toggleOverride(e) {
    this.setData({
      importOverride: !this.data.importOverride
    })
  },

  async confirmImport() {
    const { importOverride } = this.data
    const defaultProducts = DEFAULT_PRODUCTS
    this.setData({ importing: true })

    try {
      wx.showLoading({ title: '正在导入商品数据...', mask: true })

      const result = await callCloudRaw('import-data', {
        action: 'import-products',
        override: importOverride
      })

      wx.hideLoading()

      if (result.success) {
        wx.showModal({
          title: '导入完成',
          content: `成功导入 ${result.successCount} 个商品，失败 ${result.failCount} 个`,
          showCancel: false,
          success: () => {
            this.hideImportDialog()
            this.loadProducts()
          }
        })
      } else {
        wx.showToast({ title: '导入失败', icon: 'none' })
      }
    } catch (err) {
      wx.hideLoading()
      wx.showToast({ title: '导入出错', icon: 'none' })
      console.error(err)
    } finally {
      this.setData({ importing: false })
    }
  },
  onFontScaleChange(scale) {
    uiStyle.applyUiStyle(this)
  }
})
