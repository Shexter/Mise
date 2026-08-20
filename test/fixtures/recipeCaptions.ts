import type { MeasureUnit } from '../../src/types';

export type RecipeCaptionTrait =
  | 'social'
  | 'youtube'
  | 'cjk'
  | 'prose_quantity'
  | 'mostly_hashtags'
  | 'bare_link'
  | 'non_recipe';

export interface RecipeCaptionIngredient {
  name: string;
  quantity: number | null;
  unit: MeasureUnit | null;
}

export interface RecipeCaptionExpected {
  title: string;
  ingredients: readonly RecipeCaptionIngredient[];
  steps: readonly string[];
}

export interface RecipeCaptionFixture {
  name: string;
  traits: readonly RecipeCaptionTrait[];
  language: 'en' | 'ja' | 'zh-Hans' | 'ko';
  caption: string;
  expected: RecipeCaptionExpected | null;
  /** Names whose caption gives only prose such as "a splash" or no amount. */
  unstatedQuantityIngredients: readonly string[];
  recordedResponse: string;
}

type FixtureSource = Omit<RecipeCaptionFixture, 'recordedResponse'>;

const FIXTURES: readonly FixtureSource[] = [
  {
    name: 'Instagram chilli-crisp noodles',
    traits: ['social', 'prose_quantity'], language: 'en',
    caption: `🔥 10-MINUTE CHILLI CRISP NOODS 🔥\n\n200g wheat noodles\n2 tbsp chilli crisp\n1 tbsp soy sauce\na handful of scallions\n\nBoil, toss, slurp 😮‍💨🍜\n#noodles #easyrecipes #chilicrisp #weeknightdinner`,
    expected: {
      title: 'Chilli Crisp Noodles',
      ingredients: [
        { name: 'wheat noodles', quantity: 200, unit: 'g' },
        { name: 'chilli crisp', quantity: 2, unit: 'tbsp' },
        { name: 'soy sauce', quantity: 1, unit: 'tbsp' },
        { name: 'scallions', quantity: null, unit: null },
      ],
      steps: ['Boil the noodles.', 'Toss with chilli crisp, soy sauce, and scallions.'],
    },
    unstatedQuantityIngredients: ['scallions'],
  },
  {
    name: 'TikTok baked feta pasta',
    traits: ['social', 'prose_quantity'], language: 'en',
    caption: `the pasta that broke the internet 🧀🍅✨\n250g cherry tomatoes\n200g block feta\n300g pasta\na good glug of olive oil\nbasil to finish 🌿\nBake toms + feta, stir through hot pasta!!\n#fetapasta #pastatok #fyp #dinner #viralrecipe`,
    expected: {
      title: 'Baked Feta Pasta',
      ingredients: [
        { name: 'cherry tomatoes', quantity: 250, unit: 'g' },
        { name: 'feta', quantity: 200, unit: 'g' },
        { name: 'pasta', quantity: 300, unit: 'g' },
        { name: 'olive oil', quantity: null, unit: null },
        { name: 'basil', quantity: null, unit: null },
      ],
      steps: ['Bake the tomatoes and feta.', 'Stir through the cooked pasta and finish with basil.'],
    },
    unstatedQuantityIngredients: ['olive oil', 'basil'],
  },
  {
    name: 'Instagram crispy tofu',
    traits: ['social', 'prose_quantity'], language: 'en',
    caption: `SAVE THIS 📌 crispy sticky tofu 🥢\n✨ 400g firm tofu\n✨ 2 tbsp cornflour\n✨ 1 tbsp soy sauce\n✨ handful of sliced scallions\nAir fry till CRUNCHY then glaze 💥\n#vegan #tofulover #airfryerrecipes #asmrfood`,
    expected: {
      title: 'Crispy Sticky Tofu',
      ingredients: [
        { name: 'firm tofu', quantity: 400, unit: 'g' },
        { name: 'cornflour', quantity: 2, unit: 'tbsp' },
        { name: 'soy sauce', quantity: 1, unit: 'tbsp' },
        { name: 'scallions', quantity: null, unit: null },
      ],
      steps: ['Coat the tofu in cornflour.', 'Air fry until crisp, then glaze with soy sauce and scallions.'],
    },
    unstatedQuantityIngredients: ['scallions'],
  },
  {
    name: 'TikTok garlic butter rice',
    traits: ['social', 'prose_quantity'], language: 'en',
    caption: `leftover rice glow-up 🍚🧄\n2 cups cooked rice\ntwo cloves garlic, minced\na knob of butter\na splash of soy sauce\nFry garlic in butter, add rice, splash soy. doneeee ✨\n#ricehack #leftovers #quickmeals #foodtok`,
    expected: {
      title: 'Garlic Butter Rice',
      ingredients: [
        { name: 'cooked rice', quantity: 2, unit: 'cup' },
        { name: 'garlic', quantity: 2, unit: 'piece' },
        { name: 'butter', quantity: null, unit: null },
        { name: 'soy sauce', quantity: null, unit: null },
      ],
      steps: ['Fry the garlic in butter.', 'Add the rice and finish with soy sauce.'],
    },
    unstatedQuantityIngredients: ['butter', 'soy sauce'],
  },
  {
    name: 'Instagram mostly-hashtags spinach eggs',
    traits: ['social', 'mostly_hashtags', 'prose_quantity'], language: 'en',
    caption: `🍳💚✨ 2 eggs + a handful of spinach. Scramble. That's it.\n#breakfast #eggs #protein #easy #quick #healthy #food #reels #recipe #morning #yum #fyp #homecooking`,
    expected: {
      title: 'Spinach Scrambled Eggs',
      ingredients: [
        { name: 'eggs', quantity: 2, unit: 'piece' },
        { name: 'spinach', quantity: null, unit: null },
      ],
      steps: ['Scramble the eggs with the spinach.'],
    },
    unstatedQuantityIngredients: ['spinach'],
  },
  {
    name: 'YouTube quick shoyu ramen',
    traits: ['youtube', 'prose_quantity'], language: 'en',
    caption: `Quick Shoyu Ramen | full recipe below\n\nINGREDIENTS (2 servings)\n2 servings ramen noodles\n300 ml chicken stock\n2 tbsp soy sauce\n1 tbsp mirin\n2 eggs\nspring onion to serve\n\n00:42 Make the broth\n03:10 Cook noodles\n04:25 Assemble and top.`,
    expected: {
      title: 'Quick Shoyu Ramen',
      ingredients: [
        { name: 'ramen noodles', quantity: 2, unit: 'serving' },
        { name: 'chicken stock', quantity: 300, unit: 'ml' },
        { name: 'soy sauce', quantity: 2, unit: 'tbsp' },
        { name: 'mirin', quantity: 1, unit: 'tbsp' },
        { name: 'eggs', quantity: 2, unit: 'piece' },
        { name: 'spring onion', quantity: null, unit: null },
      ],
      steps: ['Make the broth.', 'Cook the noodles.', 'Assemble and top with spring onion.'],
    },
    unstatedQuantityIngredients: ['spring onion'],
  },
  {
    name: 'YouTube banana bread',
    traits: ['youtube'], language: 'en',
    caption: `My reliable banana bread recipe\nIngredients:\n3 ripe bananas\n100g melted butter\n150g brown sugar\n2 eggs\n200g plain flour\nMash bananas. Whisk with butter, sugar and eggs. Fold in flour. Bake at 175C for 50 minutes.`,
    expected: {
      title: 'Banana Bread',
      ingredients: [
        { name: 'ripe bananas', quantity: 3, unit: 'piece' },
        { name: 'butter', quantity: 100, unit: 'g' },
        { name: 'brown sugar', quantity: 150, unit: 'g' },
        { name: 'eggs', quantity: 2, unit: 'piece' },
        { name: 'plain flour', quantity: 200, unit: 'g' },
      ],
      steps: ['Mash the bananas.', 'Whisk with butter, sugar, and eggs.', 'Fold in flour and bake at 175C for 50 minutes.'],
    },
    unstatedQuantityIngredients: [],
  },
  {
    name: 'YouTube chickpea curry',
    traits: ['youtube', 'prose_quantity'], language: 'en',
    caption: `15 Minute Chickpea Curry\n\nINGREDIENTS\n400g chickpeas\n400g chopped tomatoes\n2 tsp garam masala\n200ml coconut milk\nsalt to taste\n\nSimmer everything for 15 minutes and serve.`,
    expected: {
      title: '15 Minute Chickpea Curry',
      ingredients: [
        { name: 'chickpeas', quantity: 400, unit: 'g' },
        { name: 'chopped tomatoes', quantity: 400, unit: 'g' },
        { name: 'garam masala', quantity: 2, unit: 'tsp' },
        { name: 'coconut milk', quantity: 200, unit: 'ml' },
        { name: 'salt', quantity: null, unit: null },
      ],
      steps: ['Simmer all ingredients for 15 minutes.'],
    },
    unstatedQuantityIngredients: ['salt'],
  },
  {
    name: 'YouTube sesame soba',
    traits: ['youtube'], language: 'en',
    caption: `Cold Sesame Soba Noodles\nIngredients\n- 200 g soba noodles\n- 2 tbsp tahini\n- 1 tbsp soy sauce\n- 1 tbsp rice vinegar\n- 1 cucumber\nCook and chill the noodles. Whisk the dressing. Toss with sliced cucumber.`,
    expected: {
      title: 'Cold Sesame Soba Noodles',
      ingredients: [
        { name: 'soba noodles', quantity: 200, unit: 'g' },
        { name: 'tahini', quantity: 2, unit: 'tbsp' },
        { name: 'soy sauce', quantity: 1, unit: 'tbsp' },
        { name: 'rice vinegar', quantity: 1, unit: 'tbsp' },
        { name: 'cucumber', quantity: 1, unit: 'piece' },
      ],
      steps: ['Cook and chill the noodles.', 'Whisk the dressing.', 'Toss with sliced cucumber.'],
    },
    unstatedQuantityIngredients: [],
  },
  {
    name: 'Japanese oyakodon caption',
    traits: ['cjk'], language: 'ja',
    caption: `親子丼の作り方 🍚\n材料（2人分）\n鶏もも肉 200g\n玉ねぎ 1個\n卵 2個\nだし 150ml\n醤油 大さじ2\n鶏肉と玉ねぎを煮て、溶き卵を流し入れる。ご飯にのせて完成！`,
    expected: {
      title: '親子丼',
      ingredients: [
        { name: '鶏もも肉', quantity: 200, unit: 'g' },
        { name: '玉ねぎ', quantity: 1, unit: 'piece' },
        { name: '卵', quantity: 2, unit: 'piece' },
        { name: 'だし', quantity: 150, unit: 'ml' },
        { name: '醤油', quantity: 2, unit: 'tbsp' },
      ],
      steps: ['鶏肉と玉ねぎを煮る。', '溶き卵を流し入れ、ご飯にのせる。'],
    },
    unstatedQuantityIngredients: [],
  },
  {
    name: 'Chinese tomato egg caption',
    traits: ['cjk', 'prose_quantity'], language: 'zh-Hans',
    caption: `番茄炒蛋 🍅🥚\n食材：\n西红柿 2个\n鸡蛋 3个\n食用油 1汤匙\n盐 少许\n先炒鸡蛋盛出，再炒番茄，最后混合调味。`,
    expected: {
      title: '番茄炒蛋',
      ingredients: [
        { name: '西红柿', quantity: 2, unit: 'piece' },
        { name: '鸡蛋', quantity: 3, unit: 'piece' },
        { name: '食用油', quantity: 1, unit: 'tbsp' },
        { name: '盐', quantity: null, unit: null },
      ],
      steps: ['先炒鸡蛋盛出。', '炒番茄后与鸡蛋混合调味。'],
    },
    unstatedQuantityIngredients: ['盐'],
  },
  {
    name: 'Korean kimchi fried rice caption',
    traits: ['cjk', 'prose_quantity'], language: 'ko',
    caption: `김치볶음밥 🌶️🍚\n재료\n밥 2공기\n김치 150g\n고추장 1큰술\n참기름 한 바퀴\n대파 한 줌\n김치를 볶다가 밥과 고추장을 넣고, 참기름과 대파로 마무리해요.`,
    expected: {
      title: '김치볶음밥',
      ingredients: [
        { name: '밥', quantity: 2, unit: 'serving' },
        { name: '김치', quantity: 150, unit: 'g' },
        { name: '고추장', quantity: 1, unit: 'tbsp' },
        { name: '참기름', quantity: null, unit: null },
        { name: '대파', quantity: null, unit: null },
      ],
      steps: ['김치를 볶는다.', '밥과 고추장을 넣고 볶은 뒤 참기름과 대파로 마무리한다.'],
    },
    unstatedQuantityIngredients: ['참기름', '대파'],
  },
  {
    name: 'Japanese miso soup caption',
    traits: ['cjk', 'prose_quantity'], language: 'ja',
    caption: `基本のお味噌汁\nだし 400ml\n味噌 大さじ2\n豆腐 150g\nわかめ ひとつまみ\n長ねぎ 適量\nだしで具材を温め、火を止めて味噌を溶く。`,
    expected: {
      title: '基本のお味噌汁',
      ingredients: [
        { name: 'だし', quantity: 400, unit: 'ml' },
        { name: '味噌', quantity: 2, unit: 'tbsp' },
        { name: '豆腐', quantity: 150, unit: 'g' },
        { name: 'わかめ', quantity: null, unit: null },
        { name: '長ねぎ', quantity: null, unit: null },
      ],
      steps: ['だしで具材を温める。', '火を止めて味噌を溶く。'],
    },
    unstatedQuantityIngredients: ['わかめ', '長ねぎ'],
  },
  {
    name: 'Chinese smashed cucumber caption',
    traits: ['cjk', 'prose_quantity'], language: 'zh-Hans',
    caption: `拍黄瓜｜夏天必做 🥒\n黄瓜 2根\n蒜 3瓣\n生抽 1汤匙\n香油 少许\n盐 适量\n黄瓜拍碎切段，加入调料拌匀。`,
    expected: {
      title: '拍黄瓜',
      ingredients: [
        { name: '黄瓜', quantity: 2, unit: 'piece' },
        { name: '蒜', quantity: 3, unit: 'piece' },
        { name: '生抽', quantity: 1, unit: 'tbsp' },
        { name: '香油', quantity: null, unit: null },
        { name: '盐', quantity: null, unit: null },
      ],
      steps: ['黄瓜拍碎切段。', '加入调料拌匀。'],
    },
    unstatedQuantityIngredients: ['香油', '盐'],
  },
  {
    name: 'Prose scallion noodles',
    traits: ['prose_quantity'], language: 'en',
    caption: `Scallion noodles for one: cook 200g fresh noodles. Warm a splash of soy sauce with two cloves garlic, minced, a handful of scallions and a drizzle of sesame oil. Toss everything together.`,
    expected: {
      title: 'Scallion Noodles',
      ingredients: [
        { name: 'fresh noodles', quantity: 200, unit: 'g' },
        { name: 'soy sauce', quantity: null, unit: null },
        { name: 'garlic', quantity: 2, unit: 'piece' },
        { name: 'scallions', quantity: null, unit: null },
        { name: 'sesame oil', quantity: null, unit: null },
      ],
      steps: ['Cook the noodles.', 'Warm the soy sauce with garlic, scallions, and sesame oil.', 'Toss together.'],
    },
    unstatedQuantityIngredients: ['soy sauce', 'scallions', 'sesame oil'],
  },
  {
    name: 'Prose lemon chicken',
    traits: ['prose_quantity'], language: 'en',
    caption: `Weeknight lemon chicken: season two chicken thighs with salt. Brown them in a drizzle of olive oil, then squeeze over half a lemon and add a few sprigs of thyme. Cover and cook through.`,
    expected: {
      title: 'Weeknight Lemon Chicken',
      ingredients: [
        { name: 'chicken thighs', quantity: 2, unit: 'piece' },
        { name: 'salt', quantity: null, unit: null },
        { name: 'olive oil', quantity: null, unit: null },
        { name: 'lemon', quantity: 0.5, unit: 'piece' },
        { name: 'thyme', quantity: null, unit: null },
      ],
      steps: ['Season and brown the chicken thighs.', 'Add lemon and thyme, cover, and cook through.'],
    },
    unstatedQuantityIngredients: ['salt', 'olive oil', 'thyme'],
  },
  {
    name: 'Bare Instagram link',
    traits: ['bare_link', 'non_recipe'], language: 'en',
    caption: 'https://www.instagram.com/reel/C9example/',
    expected: null, unstatedQuantityIngredients: [],
  },
  {
    name: 'Bare TikTok link',
    traits: ['bare_link', 'non_recipe'], language: 'en',
    caption: 'https://www.tiktok.com/@cook/video/7390000000000000000',
    expected: null, unstatedQuantityIngredients: [],
  },
  {
    name: 'Restaurant recommendation',
    traits: ['non_recipe'], language: 'en',
    caption: `Best noodles in Vancouver? 🍜 We tried the new spot on Main Street and the patio is gorgeous. Order the house dan dan noodles and cucumber salad. 9/10, would queue again! #vancouvereats #restaurantreview`,
    expected: null, unstatedQuantityIngredients: [],
  },
  {
    name: 'Food review with hashtags',
    traits: ['social', 'mostly_hashtags', 'non_recipe'], language: 'en',
    caption: `🥐✨ weekend pastry crawl!!! The pistachio croissant was unreal and the coffee was perfect ☕😍\n#brunch #foodie #cafehopping #croissant #weekend #cityeats #review #viral #fyp`,
    expected: null, unstatedQuantityIngredients: [],
  },
] as const;

export const RECIPE_CAPTION_FIXTURES: readonly RecipeCaptionFixture[] = FIXTURES.map((fixture) => ({
  ...fixture,
  recordedResponse: fixture.expected === null
    ? JSON.stringify({ is_recipe: false })
    : JSON.stringify({
        is_recipe: true,
        title: fixture.expected.title,
        ingredients: fixture.expected.ingredients,
        steps: fixture.expected.steps,
      }),
}));
