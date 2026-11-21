/* EverPaw Home — names, prices and every word of the interface, in English and Chinese. */
export const ROOM_TEXT = {
  bay: { name: ['Window seat', '飘窗房'], note: ['A long window, a sage seat under it, books by the wall. The sun moves across the floor.', '一整面长窗，窗下是鼠尾草绿的飘窗，墙边一排书。阳光会在地板上慢慢移动。'] },
  attic: { name: ['Attic room', '阁楼'], note: ['Under the roof: a skylight, a brick chimney, an old blue trunk.', '屋顶下面：一扇天窗、一段红砖烟囱、一只旧的蓝色箱子。'] },
  glass: { name: ['Glasshouse', '玻璃花房'], note: ['Glass on two sides, terracotta tiles, a long planter full of green.', '两面都是玻璃，陶土色地砖，一长条种满绿植的花槽。'] },
};

export const THING_TEXT = {
  windowseat: { name: ['Window seat', '飘窗'] }, trunk: { name: ['Old trunk', '旧箱子'] },
  water: { name: ['Water bowl', '水碗'] }, food: { name: ['Food bowl', '饭碗'] },
  petbed: { price: 2.99, name: ['Round bed', '圆形小窝'], does: ['A soft bed with a raised edge. {n} will sleep here.', '带围边的软窝，{n} 以后会睡在这里。'] },
  cattree: { price: 4.99, only: 'cat', name: ['Cat tree', '猫爬架'], does: ['Two perches and a hanging ball. {n} can jump up and nap on top.', '两层平台加一个吊球，{n} 可以跳上去在顶上打盹。'] },
  box: { price: 0.99, name: ['Cardboard box', '纸箱'], does: ['An open box. Some of them ask for nothing else.', '一个敞口的纸箱。有的孩子只要这个就够了。'] },
  ball: { price: 0.99, name: ['Ball', '小球'], does: ['Rolls across the floor. Choose it when you play.', '会在地板上滚，陪它玩的时候可以选。'] },
  bone: { price: 1.49, name: ['Chew bone', '磨牙骨头'], does: ['Something to chase and carry. Choose it when you play.', '可以追、可以叼，陪它玩的时候可以选。'] },
  sofa: { price: 5.99, name: ['Sofa', '沙发'], does: ['A three-seater with one cushion.', '三人位沙发，带一个靠垫。'] },
  armchair: { price: 3.99, name: ['Armchair', '单人沙发'], does: ['A deep chair for a corner.', '适合放在角落的单人沙发。'] },
  bookshelf: { price: 4.99, name: ['Bookshelf', '书架'], does: ['Four shelves of books and one small plant.', '四层书，还有一小盆植物。'] },
  lamp: { price: 2.49, name: ['Floor lamp', '落地灯'], does: ['Comes on by itself in the evening.', '到了傍晚会自己亮起来。'] },
  plant: { price: 1.99, name: ['Potted plant', '盆栽'], does: ['Something green for a corner.', '给角落添一点绿色。'] },
  monstera: { price: 2.99, name: ['Monstera', '龟背竹'], does: ['Tall, with big leaves.', '高一些，叶子很大。'] },
  flowers: { price: 2.49, name: ['Flowers on a stand', '花架上的花'], does: ['A vase of flowers on a small round stand.', '小圆几上的一瓶花。'] },
  candles: { price: 1.99, name: ['Candles', '蜡烛'], does: ['Three candles on a low cabinet. They glow at night.', '矮柜上的三支蜡烛，夜里会发光。'] },
  rug: { price: 2.99, name: ['Round rug', '圆地毯'], does: ['A soft place in the middle of the floor.', '地板中间一块柔软的地方。'] },
};

export const SPECIES_TEXT = {
  cat: ['Cat', '猫'], dog: ['Dog', '狗'], rabbit: ['Rabbit', '兔子'], hamster: ['Hamster', '仓鼠'], parrot: ['Parrot', '鹦鹉'], turtle: ['Turtle', '乌龟'],
};
export const PATTERNS = { solid: ['One colour', '纯色'], belly: ['Light belly', '浅色肚皮'], patches: ['Patches', '花斑'], stripes: ['Stripes', '条纹'], points: ['Dark points', '重点色'] };

export const STR = {
  brand_note: ['A home that keeps', '一个一直都在的家'],
  nav_home: ['Home', '家'], nav_decorate: ['Decorate', '布置'], nav_keep: ['Keepsakes', '纪念'],
  lang_switch: ['中文', 'EN'], lang_label: ['Switch to Chinese', '切换到英文'], menu_label: ['Home settings', '家的设置'],
  // what they are doing
  st_home: ['{n} is home.', '{n} 到家了。'], st_idle: ['{n} is looking around.', '{n} 正四处看看。'], st_walk: ['{n} is wandering about.', '{n} 在屋里溜达。'],
  st_sit: ['{n} sat down and is watching you.', '{n} 坐下来看着你。'], st_sleep: ['{n} is asleep on the floor.', '{n} 在地板上睡着了。'], st_sleep_on: ['{n} is asleep on the {on}.', '{n} 在{on}上睡着了。'],
  st_to_water: ['{n} is heading for the water.', '{n} 朝水碗走过去了。'], st_drink: ['{n} is drinking.', '{n} 在喝水。'], st_drank: ['{n} had a long drink.', '{n} 喝了好一会儿水。'],
  st_to_food: ['{n} heard the bowl and is on the way.', '{n} 听见碗响，正赶过来。'], st_eat: ['{n} is eating.', '{n} 在吃饭。'], st_ate: ['{n} cleaned the bowl.', '{n} 把碗吃干净了。'],
  st_play: ['{n} is after the {toy}.', '{n} 在追{toy}。'], st_played: ['{n} is worn out and pleased with the {toy}.', '{n} 玩{toy}玩累了，很满足。'],
  st_happy: ['{n} loves that.', '{n} 很喜欢这样。'], st_shy: ['{n} tucked in. Give it a second.', '{n} 缩回去了，等一下就好。'], st_stir: ['{n} stirs, then settles again.', '{n} 动了一下，又睡了。'],
  st_coming: ['{n} is coming over.', '{n} 正朝你走来。'], st_came: ['{n} came when you called.', '你一叫，{n} 就过来了。'],
  // home
  care_water: ['Fresh water', '换水'], care_feed: ['Feed', '喂饭'], care_play: ['Play', '陪它玩'], care_sit: ['Sit together', '坐一会儿'], care_label: ['Things you can do', '可以做的事'],
  hint: ['Tap {n} to pet. Tap the floor to call. Drag to turn the room.', '点一下 {n} 可以摸摸它，点地板可以叫它过来，拖动可以转动房间。'],
  no_toys: ['No toys in the home yet.', '家里还没有玩具。'], find_toy: ['Find one in Decorate', '去“布置”里挑一个'], choose_toy: ['Choose a toy', '选一个玩具'],
  words_h: ['A few words', '想说的话'], words_empty: ['Nothing written yet.', '还没有写。'], edit: ['Edit', '修改'],
  inhome_h: ['Brought home', '带回家的东西'], inhome_empty: ['Nothing yet. The room came furnished; anything you add shows up here.', '还没有。房间自带家具，你添置的东西会出现在这里。'],
  from_you: ['You brought this', '你带来的'], from_by: ['From {by}', '来自 {by}'],
  lately_h: ['Lately', '最近'], all_keep: ['All keepsakes', '全部纪念'], go_decorate: ['Decorate the home', '布置这个家'],
  calm_line: ['Sitting with {n}. Stay as long as you like.', '陪着 {n}。想坐多久都可以。'], calm_leave: ['Leave quietly', '轻轻离开'], st_sat: ['You sat with {n} for a while.', '你陪 {n} 坐了一会儿。'],
  // decorate
  dec_h: ['Decorate {n}’s home', '布置 {n} 的家'], dec_p: ['Drag furniture across the floor. It snaps to the grid, and {n} will walk around whatever you place.', '在地板上拖动家具，会自动对齐格子，{n} 会绕开你摆的东西走。'],
  sel_none: ['Tap a piece of furniture to move, turn or put it away.', '点一件家具，可以移动、旋转或收起。'],
  turn: ['Turn', '旋转'], put_away: ['Put away', '收起来'], bring_back: ['Bring back', '拿出来'], no_room: ['There is no room to turn it there.', '那个位置转不开。'],
  trying: ['Trying it out', '试放中'], keep_it: ['Keep it · {p}', '留下 · {p}'], take_out: ['Take it out', '拿走'],
  add_h: ['Add something', '添点东西'], add_p: ['Tap one to try it in the room first. Nothing is added until you keep it.', '点一下先放进房间试试，确认留下才会添置。'],
  have_tag: ['In the home', '已在家里'], away_h: ['Put away', '已收起'],
  room_h: ['The room', '房间'], room_p: ['Change it any time. Each room remembers how you arranged it.', '随时可以换，每个房间会记住你的布置。'],
  // checkout
  pay_h: ['Keep the {t}?', '留下{t}吗？'], total: ['Total', '合计'], pay_note: ['Payments are not connected yet. This is a test checkout and nothing is charged.', '支付还没有接通，这是测试结账，不会扣款。'],
  pay_go: ['Confirm · {p}', '确认 · {p}'], cancel: ['Cancel', '取消'], toast_added: ['{t} added to {n}’s home.', '{t}已添置到 {n} 的家。'], toast_stored: ['Put away. You can bring it back any time.', '收起来了，随时可以拿出来。'],
  // keepsakes
  keep_h: ['{n}’s home, so far', '{n} 的家，到现在'], keep_p: ['What has come into the home, and when. Visits are never counted and there is nothing to keep up.', '什么东西在什么时候来到这个家。不统计来访次数，也没有需要坚持的任务。'],
  e_opened: ['{n}’s home opened.', '{n} 的家建好了。'], e_bought: ['You brought home the {t}.', '你带回了{t}。'], e_room: ['Moved to the {t}.', '搬到了{t}。'],
  // create
  c_h_memory: ['Make a home for {n}.', '给 {n} 一个家。'], c_h_new: ['Bring {n} home.', '把 {n} 带回家。'], c_them: ['them', '它'],
  c_p: ['Pick who they are and where they live. It takes a minute, and you can change everything later.', '选好它是谁、住在哪里。一分钟就够，之后都能改。'],
  f_purpose: ['This home is for', '这个家是给'], pur_memory: ['A pet I’ve lost', '一只已经离开的宠物'], pur_memory_s: ['A place to keep looking after them.', '一个可以继续照顾它的地方。'],
  pur_new: ['A new companion', '一只新的小伙伴'], pur_new_s: ['A pet that lives here, with you.', '一只住在这里、陪着你的宠物。'],
  f_species: ['They are a', '它是'], f_name: ['Their name', '它的名字'], f_years: ['Their years', '它的年份'], optional: ['Optional', '选填'], f_years_ph: ['2012 – 2026', '2012 – 2026'],
  f_photo: ['One photo of them', '一张它的照片'], f_photo_p: ['We read their colours from it, and it hangs on the wall. It stays on this device.', '我们从照片里读出它的毛色，照片会挂在墙上，只保存在这台设备上。'],
  photo_add: ['Choose a photo', '选择照片'], photo_change: ['Change photo', '更换照片'], photo_read: ['Colours read from the photo. Adjust them if they look off.', '已从照片读出毛色，不准的话可以自己调。'],
  photo_bad: ['That file did not open as a picture. Try a JPG or PNG.', '这个文件打不开，换一张 JPG 或 PNG 试试。'],
  f_look: ['How they look', '它的样子'], col_base: ['Main colour', '主色'], col_second: ['Light parts', '浅色部分'], col_dark: ['Markings', '花纹'], f_pattern: ['Markings', '花纹'],
  f_ears: ['Ears', '耳朵'], ear_flop: ['Floppy', '垂耳'], ear_point: ['Upright', '立耳'], f_size: ['Size', '体型'], size_s: ['Small', '小'], size_m: ['Medium', '中'], size_l: ['Large', '大'],
  f_room: ['Where they live', '住在哪里'],
  err_name: ['Add their name to open the home.', '先填上它的名字。'],
  c_open: ['Open {n}’s home', '打开 {n} 的家'], c_open_plain: ['Open their home', '打开它的家'],
  prev_cap: ['This is {n}. Tap them, or tap the floor.', '这就是 {n}。点一下它，或者点一下地板。'], prev_cap_plain: ['Tap them, or tap the floor to call them over.', '点一下它，或者点地板叫它过来。'],
  promise1: ['Nothing here goes hungry or lonely while you are away.', '你不在的时候，这里不会有谁挨饿或孤单。'],
  promise2: ['The home is free to keep, with or without buying anything.', '这个家可以一直免费保留，买不买东西都一样。'],
  promise3: ['You can download everything or delete it whenever you like.', '随时可以下载全部内容，或者删除。'],
  // menu and misc
  m_words: ['Edit name, years and words', '修改名字、年份和想说的话'], m_look: ['Change how they look', '修改它的样子'], m_export: ['Download everything', '下载全部内容'],
  m_remind: ['Reminders are off. EverPaw never sends “come back” messages.', '提醒是关闭的。EverPaw 不会发“快回来看看”这类消息。'],
  m_delete: ['Delete this home', '删除这个家'], del_confirm: ['Delete {n}’s home from this device? This cannot be undone.', '要从这台设备上删除 {n} 的家吗？删除后无法恢复。'],
  exported: ['Downloaded the whole home as a file.', '已把整个家下载成文件。'], save_fail: ['This browser would not save the home. It will last until you close the tab.', '这个浏览器没法保存，关闭页面后会丢失。'],
  done: ['Done', '完成'], close: ['Close', '关闭'], save: ['Save', '保存'], words_ph: ['Something you would say about them', '想对它说的，或者关于它的一句话'],
  foot: ['A home is saved on this device only for now. Payments are not connected: checkout is in test mode.', '目前这个家只保存在这台设备上。支付还未接通，结账为测试模式。'],
  sound_on: ['Sound on', '声音已开'], sound_off: ['Sound off', '声音已关'], sound_label: ['Turn sound on or off', '开关声音'],
  about_h: ['About {n}', '关于 {n}'], about_open: ['About {n}, and what they are doing now', '关于 {n}，以及它现在在做什么'],
  next: ['Next', '下一步'], back: ['Back', '上一步'], step_who: ['Who they are', '它是谁'], step_look: ['How they look', '它的样子'], step_home: ['Where they live', '住在哪里'],
  step_of: ['Step {a} of {b}', '第 {a} 步，共 {b} 步'], drawer_close: ['Close panel', '关闭面板'],
  zoom_hint: ['Scroll to move closer.', '滚动可以拉近。'],
  skip: ['Skip to content', '跳到正文'], no3d: ['This browser could not start 3D graphics, so the room cannot be shown here.', '这个浏览器无法启动 3D 图形，所以这里显示不了房间。'],
};
