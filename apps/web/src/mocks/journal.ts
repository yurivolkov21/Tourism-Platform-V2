import type { MockJournalPost } from './types.js';

// Ứng viên schema khi gắn API (tiền đề hệ blogs như Nexora): bảng blog_posts
// (slug · title · excerpt · category · author · published_at · read_minutes ·
// hero_image) — shape này là bản nháp khám phá, chốt lúc reconcile Prisma.
// `sections` là thân bài thật, cùng hình dạng LegalDoc.sections nên dùng
// chung được tocFromSections + Typeset của cụm trang pháp lý.
export const JOURNAL_POSTS: MockJournalPost[] = [
  {
    slug: 'what-to-pack-for-the-mist-season',
    title: 'What to pack for the mist season',
    excerpt:
      'A light jacket, real shoes, and patience. The terraces reward all three — our guides share their honest checklist.',
    date: '2026-10-02',
    readMinutes: 6,
    image: '/mock/journal-mist.jpg',
    category: 'Packing',
    author: 'Mai — Sa Pa guide',
    sections: [
      {
        heading: 'Layers beat one big coat',
        paragraphs: [
          'Sa Pa runs cold at 6am and warm by noon. I have watched guests peel off a puffer jacket on the Cat Cat trail before 11am and carry it the rest of the day. A fleece under a thin rain shell handles both ends without the extra weight in your bag.',
          'Bring gloves for the cable car up to Fansipan. The summit platform sits well below freezing from November through February, and the wind at 3,143 metres cuts through anything thinner than wool.',
        ],
      },
      {
        heading: 'Shoes that already know mud',
        paragraphs: [
          'The rice terrace paths turn to red clay after rain, and it rains most afternoons from June to September. New boots straight out of the box slip on that clay. Bring the pair you have already broken in, ideally with tread left on the sole.',
          'Sandals are fine for the hotel courtyard. They are not fine for the descent past Lao Chai village, where the trail drops steeply toward the Muong Hoa river and the footing turns loose.',
        ],
      },
      {
        heading: 'What actually earns its space in the bag',
        bullets: [
          'A dry bag for the short boat crossing near Ta Van',
          'A headlamp — village guesthouses cut the generator around 10pm',
          'Small notes: 10,000 and 20,000 VND bills, since market stalls rarely break a 500,000',
          'Motion sickness tablets for the overnight train from Hanoi',
          'A scarf bought at the Sunday market in Bac Ha, not one packed from home',
        ],
      },
      {
        heading: 'The one thing everyone forgets',
        paragraphs: [
          'Signal drops out past Silver Waterfall and stays patchy for most of the trek. Download your offline maps while you still have a connection in Hanoi, and warn whoever is waiting for a message that you will go quiet for a day.',
        ],
      },
    ],
  },
  {
    slug: 'eating-your-way-through-hoi-an',
    title: 'Eating your way through Hoi An',
    excerpt:
      'Cao lầu at a market stall, bánh mì by the river, and the one dessert locals queue for after dark.',
    date: '2026-09-18',
    readMinutes: 8,
    image: '/mock/hoian.jpg',
    category: 'Food',
    author: 'Linh — Hội An guide',
    sections: [
      {
        heading: 'Cao lầu, and why the noodles taste different here',
        paragraphs: [
          'Real cao lầu uses water drawn from the Ba Le well, or so every stall owner in town will tell you. The noodles come out thick and slightly chewy, tossed with barbecued pork, fresh greens, and crisp croutons cut from the same dough.',
          'Go to the stalls inside the central market before noon. By 1pm the good ones have usually sold out, and the pot left simmering after that is never quite the same batch.',
        ],
      },
      {
        heading: 'Bánh mì by the river',
        paragraphs: [
          'Madam Khánh runs a small counter two streets back from the river, and the queue by 7am already stretches past the neighbouring shophouse. Order the mixed version — pâté, a soft egg, pickled carrot, and a spoon of chilli sauce she mixes herself.',
          'Eat it standing at the counter if you can. It travels fine wrapped in paper, but the bread loses its crackle within twenty minutes.',
        ],
      },
      {
        heading: 'The market before 7am',
        paragraphs: [
          'Before the tour buses arrive, the central market belongs to residents buying breakfast. Bánh xèo sizzles on flat pans at the back corner, and a woman near the fish section sells hến rice — tiny river clams stir-fried with rice and herbs, eaten with fried rice crackers.',
          'Go with someone who already knows which stall is which. The market has no signs in English, and pointing works, but a local elbow saves you from three wrong bowls first.',
        ],
      },
      {
        heading: 'The dessert queue after dark',
        bullets: [
          'Chè bắp — sweet corn pudding, best warm, sold from a cart near Cam Nam bridge',
          'Tào phớ — silken tofu in ginger syrup, a few coins for a bowl',
          'Bánh flan cà phê — coffee flan, sold at the same carts most nights after 8pm',
        ],
      },
      {
        heading: 'One rule for eating well here',
        paragraphs: [
          'Follow where the motorbikes stop, not where the menu has photos. A queue of parked bikes outside a plastic-stool stall is worth more than any sign in three languages.',
        ],
      },
    ],
  },
  {
    slug: 'floating-markets-before-sunrise',
    title: 'Floating markets before sunrise',
    excerpt:
      'Why the Mekong wakes up at 4am, and how to see Cái Răng the way traders do — from the water, with coffee.',
    date: '2026-08-30',
    readMinutes: 5,
    image: '/mock/mekong.jpg',
    category: 'Markets',
    author: 'Tâm — Cần Thơ guide',
    sections: [
      {
        heading: 'Why 4am, not 8am',
        paragraphs: [
          'Wholesale trading at Cái Răng peaks between 5am and 6:30am, when the big boats sell sacks of pineapple and dragon fruit to smaller buyers who then move on to town markets. Arrive after 7am and you mostly see empty hulls and tourists.',
          'Leaving the dock at 4:30am feels absurd the night before and completely obvious once you are on the water and the sky starts to turn.',
        ],
      },
      {
        heading: 'Getting on the water',
        paragraphs: [
          'Boats leave from Ninh Kieu wharf. Agree the price before you step in, not after — a small boat for two people should run under 400,000 VND for a two-hour loop, more if you add the narrower canals toward Phong Dien.',
          'Wear something you do not mind getting a little wet. Spray comes over the bow whenever a larger cargo boat passes close.',
        ],
      },
      {
        heading: 'Reading the poles',
        paragraphs: [
          'Each boat hangs a bamboo pole, called a cây bẹo, with a sample of whatever it is selling tied to the top — a pineapple, a bunch of bananas, a coconut. Traders never shout their goods here; the pole does the advertising, and buyers scan the skyline of poles the way you might scan shop signs on a street.',
          'A pole with nothing tied to it, or with a leafy branch instead of produce, means the boat itself is for sale.',
        ],
      },
      {
        heading: 'Coffee on the boat',
        paragraphs: [
          'A rowing coffee vendor works the market every morning, calling out to the trading boats. Order a cà phê sữa đá and drink it right there, ice rattling against the glass, while the sun clears the tree line on the far bank.',
        ],
      },
    ],
  },
  {
    slug: 'reading-a-hue-royal-tomb',
    title: 'Reading a Huế royal tomb',
    excerpt:
      'A Nguyễn tomb is a garden first and a grave second. Once you know the order to walk it in, the whole design opens up.',
    date: '2026-05-29',
    readMinutes: 7,
    image: '/mock/hue.jpg',
    category: 'Culture',
    author: 'Quang — Huế guide',
    sections: [
      {
        heading: 'A garden before it is a grave',
        paragraphs: [
          'Emperor Tự Đức built his tomb twenty years before he needed it, and spent long stretches of his reign living there rather than in the Imperial City. The lake, the pavilions, and the pine-covered hills came first. The burial mound, tucked off to one side and easy to miss, came almost as an afterthought.',
          'That order matters. Walk the site expecting a cemetery and you will wonder where the point is. Walk it expecting a retreat built by a poet-emperor, and the pavilions over Lưu Khiêm lake make immediate sense.',
        ],
      },
      {
        heading: 'The lake and the poetry pavilion',
        paragraphs: [
          'Xung Khiêm pavilion sits over the water on stilts, built for an emperor who wrote thousands of poems and wanted somewhere quiet to do it. Sit there for a few minutes before moving on — most visitors walk straight through toward the tomb itself and miss why the pavilion was placed exactly there, facing the widest part of the lake.',
        ],
      },
      {
        heading: 'Khải Định — concrete, mosaic, and a different century',
        paragraphs: [
          'A short drive away, Khải Định built his tomb in the 1920s using imported cement and steel, then covered nearly every surface inside with mosaic made from broken glass and porcelain. It looks nothing like Tự Đức, and it is not supposed to — Khải Định wanted a tomb that showed he had seen Europe.',
          'The mosaic ceiling of the burial chamber took an artisan named Phan Văn Tánh over a decade. Look up before you look at the bronze statue of the emperor below it.',
        ],
      },
      {
        heading: 'How to actually walk a Nguyễn tomb',
        bullets: [
          'Start at the honour courtyard — the stone mandarins and elephants lined up facing the entrance',
          "Read the stele house next, usually the tallest single structure, recording the emperor's own account of his reign",
          'Save the burial mound or chamber for last — it is deliberately the smallest, quietest part of the site',
        ],
      },
      {
        heading: 'Getting there without the midday heat',
        paragraphs: [
          'Both tombs sit south of the city along the Perfume River. A boat leaving Huế around 7am reaches Tự Đức before the tour groups and before the heat turns the courtyards into a furnace. Cyclos work too, but plan for the hills — Khải Định is built up a slope, and no cyclo driver enjoys pedalling it in August.',
        ],
      },
    ],
  },
  {
    slug: 'two-days-among-the-karsts',
    title: 'Two days among the karsts',
    excerpt:
      'Tam Coc by rowboat on day one, Trang An by foot and boat on day two — the same limestone, told two different ways.',
    date: '2026-05-12',
    updated: '2026-07-20',
    readMinutes: 6,
    image: '/mock/ninhbinh.jpg',
    category: 'Nature',
    author: 'Hà — Ninh Bình guide',
    sections: [
      {
        heading: 'Day one: Tam Coc by rowboat',
        paragraphs: [
          'The boats on the Ngô Đồng river are rowed with the feet, not the arms — the rower sits facing forward and pushes the oars with their legs, freeing both hands for a photo if you ask. It looks impossible until you have watched someone do it for an hour without slowing down.',
          'The route passes through three limestone caves — Hang Cả, Hang Hai, and Hang Ba — each one lower than the last. In Hang Ba you will need to duck. Bring a hat you do not mind losing to a low ceiling.',
        ],
      },
      {
        heading: 'Mua Cave and the five hundred steps',
        paragraphs: [
          'The viewpoint above Mua Cave is not really about the cave — it is about the climb. Roughly five hundred stone steps switchback up the karst behind it, past a dragon statue partway up, to a lookout over the whole valley and the river winding through the rice fields below.',
          'Go up an hour before sunset. The climb takes about thirty minutes at an easy pace, and the light on the karsts turns gold well before the sun actually sets.',
        ],
      },
      {
        heading: 'Day two: Tràng An is the longer story',
        paragraphs: [
          'Where Tam Coc is one river and three caves, Tràng An is a nine-kilometre loop through caves, temples, and open water, stringing together far more karst than a single afternoon at Tam Coc can show you. Budget three hours on the water, not one.',
          "Ba Cốc route brings you past a temple dedicated to a Đinh dynasty king, buried at the water's edge rather than in a tomb built up high — worth the extra twenty minutes to see it.",
        ],
      },
      {
        heading: 'Bích Động pagoda, built into the rock itself',
        paragraphs: [
          'Bích Động pagoda is carved directly into a karst face in three levels, connected by narrow stone stairs. The middle level, half inside a cave, stays cool even at midday and is the quietest of the three.',
        ],
      },
      {
        heading: 'What changed since last season',
        paragraphs: [
          'Boat fares at Tam Coc now run a fixed 200,000 VND per rower rather than the loose bargaining of a year ago, so there is less haggling at the dock than there used to be. Bring cash regardless — the wharf still does not take cards.',
        ],
      },
    ],
  },
  {
    slug: 'crossing-hanoi-on-foot',
    title: 'Crossing Hanoi on foot',
    excerpt:
      'The Old Quarter rewards walking more than any other way of seeing it — once you learn how to cross the street.',
    date: '2026-07-21',
    readMinutes: 5,
    image: '/mock/hanoi-oldquarter.jpg',
    category: 'Practical',
    author: 'Dũng — Hà Nội guide',
    sections: [
      {
        heading: 'Thirty-six streets, thirty-six guilds',
        paragraphs: [
          'Every street in the Old Quarter was once home to a single trade, and most still carry the name — Hàng Bạc for the silversmiths, Hàng Mã for paper offerings, Hàng Thiếc for tinware. Walk with that in mind and the grid stops feeling random; each corner still roughly sells what its name says it should.',
          'Some trades have shifted with time. Hàng Gai, once the silk street, is now mostly tailors, but the silk shops that remain are worth seeking out over the newer arrivals.',
        ],
      },
      {
        heading: 'How to actually cross the street',
        paragraphs: [
          'Step off the curb at a steady pace and keep walking at that same pace. The motorbikes are reading your speed and adjusting around you — a sudden stop or a sudden dash is the one thing that actually causes a collision, because it breaks the prediction every rider around you has already made.',
          'Never look back over your shoulder mid-crossing. It costs you half a second of forward pace, and that half second is exactly what the rider behind you was counting on.',
        ],
      },
      {
        heading: 'The loop that costs nothing',
        paragraphs: [
          'Start at Hoàn Kiếm lake before 7am, while it still belongs to the tai chi groups and the badminton games rather than traffic. Walk north into the Old Quarter, then out to Đồng Xuân market, the largest covered market in the city, busiest and loudest by mid-morning.',
        ],
      },
      {
        heading: 'Where your feet actually get tired',
        paragraphs: [
          'The walk across Long Biên bridge is longer than it looks from either bank — about 1.7 kilometres of steel truss over the Red River, built by the French and rebuilt more than once since. Trains still cross it, on the same single track pedestrians and mopeds share, so keep to the outer walkway.',
        ],
      },
      {
        heading: 'What to watch for underfoot',
        bullets: [
          'Sidewalk barbers with a mirror hung on a tree — do not step through their setup',
          'Steaming pots left right at the curb outside noodle stalls',
          'Dog leashes stretched across the pavement at ankle height',
        ],
      },
    ],
  },
  {
    slug: 'the-bay-without-the-crowds',
    title: 'The bay without the crowds',
    excerpt:
      'Everyone photographs the same ten karsts on the standard loop. Lan Hạ Bay, one headland over, gets almost none of them.',
    date: '2026-06-15',
    readMinutes: 7,
    image: '/mock/halong.jpg',
    category: 'Nature',
    author: 'Hải — Hạ Long guide',
    sections: [
      {
        heading: 'Why the same ten karsts show up in every photo',
        paragraphs: [
          'Most day boats out of Hạ Long City run one of three set routes, all passing the same handful of well-known formations — Gà Chọi, the caves at Sửng Sốt, Ti Tốp island. On a busy weekend, a dozen boats can be anchored at the same viewpoint within the same ten minutes.',
        ],
      },
      {
        heading: 'One headland over: Lan Hạ Bay',
        paragraphs: [
          'Lan Hạ Bay sits south of the main Hạ Long route, reached through Cát Bà rather than the city pier, and carries the same limestone karst scenery with a fraction of the boat traffic. Kayaking here means paddling into coves with no other boat in sight, which almost never happens on the standard loop.',
          'Việt Hải, a small fishing village on Cát Bà island, has no road connection to the rest of the island — everything still arrives by boat, including the motorbikes.',
        ],
      },
      {
        heading: 'Timing matters more than the route',
        paragraphs: [
          'A weekday departure clears out most of the crowd regardless of which bay you choose. Early boats, leaving the pier before 8am, also beat both the tour buses and the midday haze that tends to flatten the light on photos taken after 11am.',
        ],
      },
      {
        heading: 'What an overnight actually buys you',
        paragraphs: [
          'A day trip gets you the scenery. An overnight gets you the empty cove at 6pm after the day boats have gone home, and the same cove again at sunrise before anyone else is awake. That quiet hour is the part guests remember longest, more than any single karst formation.',
        ],
      },
      {
        heading: 'Booking it properly',
        bullets: [
          'Confirm the boat holds a valid tourism operating licence — ask to see it, reputable operators show it without hesitation',
          "Departures from Cát Bà's Bến Bèo pier reach Lan Hạ faster than the Hạ Long City pier",
          'Life jackets should be provided and worn for kayaking, not just stored under a seat',
        ],
      },
    ],
  },
  {
    slug: 'bridges-beaches-and-bun-cha-ca',
    title: 'Bridges, beaches and bún chả cá',
    excerpt:
      'Da Nang between a dragon that breathes fire on weekends and a bowl of fish cake soup that has nothing to do with Hoi An.',
    date: '2026-07-03',
    readMinutes: 6,
    image: '/mock/danang.jpg',
    category: 'Food',
    author: 'Trang — Đà Nẵng guide',
    sections: [
      {
        heading: 'A dragon that breathes fire on weekends',
        paragraphs: [
          'Dragon Bridge spans the Hàn river and, at 9pm on Saturday and Sunday nights, its dragon head breathes actual fire followed by a burst of water from the same mouth. Get to the riverbank twenty minutes early — the best viewing spots along Bạch Đằng street fill up fast once the show is known to be starting.',
        ],
      },
      {
        heading: 'Mỹ Khê or Non Nước',
        paragraphs: [
          'Mỹ Khê beach, closer to the city centre, gets crowded with sunbathers and beach chairs by mid-morning. Non Nước, further south near the Marble Mountains, stays quieter and pairs naturally with an afternoon exploring the caves and pagodas carved into the marble hills right behind it.',
          'Jellyfish season runs roughly April to June — check with a lifeguard stand before swimming out past the flags during those months.',
        ],
      },
      {
        heading: 'Bún chả cá, not to be confused with cao lầu',
        paragraphs: [
          'Bún chả cá is a clear fish broth soup with grilled fish cakes, turmeric, and dill, closer to the flavours of Đà Nẵng and further north than to anything served in Hội An. A stall on Trần Cao Vân street draws a local breakfast crowd from around 6:30am, mostly gone by 9am.',
        ],
      },
      {
        heading: 'The Golden Bridge day trip',
        paragraphs: [
          'Bà Nà Hills sits an hour inland by road, then a long cable car ride up through cloud cover that can hide the view completely on a wet morning. Arrive at the base station before 9am — the queue for the cable car past 10am can run over an hour on weekends.',
        ],
      },
      {
        heading: 'A city best seen slowly',
        paragraphs: [
          'Da Nang gets treated as a stopover between Hue and Hoi An more often than it deserves. Give it a full day on its own, and it stops feeling like a stopover.',
        ],
      },
    ],
  },
  {
    slug: 'when-to-come-and-when-not-to',
    title: 'When to come, and when not to',
    excerpt:
      'Vietnam runs three different climates at once. The month that is perfect in the north can be the worst possible week in the centre.',
    date: '2026-08-11',
    updated: '2026-09-05',
    readMinutes: 9,
    image: '/mock/sapa.jpg',
    category: 'Practical',
    author: 'Mai — Sa Pa guide',
    sections: [
      {
        heading: 'The north runs on its own calendar',
        paragraphs: [
          'Sa Pa and Hà Giang turn cold and often foggy from December through February, sometimes cold enough for a rare frost on the highest terraces. March and April bring clearer skies and the water-filled terraces before planting. The rainy season, June through August, brings the mud discussed elsewhere on this site, but also the deepest green of the year.',
          'September and October are harvest season — the terraces turn gold, the trails dry out, and this is the single most requested window we get for the north. Book accommodation early if this is your target.',
        ],
      },
      {
        heading: 'The centre answers to typhoons, not seasons',
        paragraphs: [
          "Huế, Hội An, and Đà Nẵng sit in the path of the annual typhoon season, running roughly October through November. Flooding in Hội An's old town is common enough in those months that some guesthouses keep sandbags by the door as a matter of routine, not emergency.",
          'February through July is the more reliable stretch for the centre — dry, hot from May onward, but dry.',
        ],
      },
      {
        heading: 'The south stays warm and rarely commits to a downpour',
        paragraphs: [
          'The Mekong Delta and Ho Chi Minh City run a dry season from December to April and a wet season the rest of the year, but "wet" here usually means a heavy hour-long shower most afternoons rather than a day lost to rain. The floating markets run on their own schedule regardless of season — tides matter more than rainfall.',
        ],
      },
      {
        heading: 'One week to avoid everywhere',
        paragraphs: [
          'Tết, the Lunar New Year, shuts down an enormous share of small businesses nationwide for the better part of a week, and transport prices spike in the days around it as the entire country travels home at once. It is a remarkable thing to witness once, but a difficult week to actually get things done or find restaurants open.',
        ],
      },
      {
        heading: 'If you can only pick one month',
        bullets: [
          'North only: October, for the harvest terraces and dry trails',
          'Centre only: March, for the driest weather before the summer heat sets in',
          'South only: December, for the start of the dry season without peak-season crowds',
          'Whole-country trip: late February to early March, after Tết settles and before the summer rain begins',
        ],
      },
    ],
  },
];
