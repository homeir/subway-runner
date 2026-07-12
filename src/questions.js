// ============================================================
// 复活答题题库 —— 上海市小学三年级 语文 / 数学 / 英语
//
// 题目格式:
//   sub:    科目 "语文" | "数学" | "英语"
//   type:   "choice"(选择) | "fill"(填空) | "judge"(判断)
//   q:      题目文字
//   options: 选择题的选项数组（4 个）
//   answer: 选择题 = 正确选项的序号(0开始)
//           填空题 = 可接受答案的数组（不区分大小写和首尾空格）
//           判断题 = true(对) / false(错)
//
// 想加新题？照着下面的格式往数组里加就行！
// ============================================================

export const QUESTIONS = [
  // ==================== 数学 ====================
  { sub: "数学", type: "choice", q: "6 × 7 = ?", options: ["36", "42", "48", "54"], answer: 1 },
  { sub: "数学", type: "choice", q: "305 + 198 = ?", options: ["493", "513", "503", "497"], answer: 2 },
  { sub: "数学", type: "fill", q: "8 × 9 = （　）", answer: ["72"] },
  { sub: "数学", type: "judge", q: "1 千米 = 1000 米", answer: true },
  { sub: "数学", type: "choice", q: "长方形长 5 厘米、宽 3 厘米，周长是多少厘米？", options: ["8", "15", "16", "30"], answer: 2 },
  { sub: "数学", type: "fill", q: "400 − 256 = （　）", answer: ["144"] },
  { sub: "数学", type: "choice", q: "3 千克 = 多少克？", options: ["30", "300", "3000", "30000"], answer: 2 },
  { sub: "数学", type: "judge", q: "500 克比 5 千克重", answer: false },
  { sub: "数学", type: "choice", q: "一天有多少个小时？", options: ["12", "24", "36", "60"], answer: 1 },
  { sub: "数学", type: "fill", q: "7 × 8 = （　）", answer: ["56"] },
  { sub: "数学", type: "choice", q: "正方形边长 4 厘米，周长是多少厘米？", options: ["8", "12", "16", "20"], answer: 2 },
  { sub: "数学", type: "judge", q: "0 乘任何数都得 0", answer: true },
  { sub: "数学", type: "choice", q: "63 ÷ 7 = ?", options: ["7", "8", "9", "6"], answer: 2 },
  { sub: "数学", type: "fill", q: "125 + 375 = （　）", answer: ["500"] },
  { sub: "数学", type: "choice", q: "1 小时 = 多少分钟？", options: ["10", "60", "100", "30"], answer: 1 },
  { sub: "数学", type: "judge", q: "四边形都有 4 条边", answer: true },
  { sub: "数学", type: "choice", q: "812 − 399 大约等于几百？", options: ["300", "400", "500", "600"], answer: 1 },
  { sub: "数学", type: "fill", q: "54 ÷ 6 = （　）", answer: ["9"] },
  { sub: "数学", type: "choice", q: "把 18 个苹果平均分给 6 个人，每人分几个？", options: ["2", "3", "4", "6"], answer: 1 },
  { sub: "数学", type: "judge", q: "一年有 13 个月", answer: false },

  // ==================== 语文 ====================
  { sub: "语文", type: "choice", q: "“骄傲”的反义词是？", options: ["自满", "谦虚", "得意", "高兴"], answer: 1 },
  { sub: "语文", type: "judge", q: "“落”字是上下结构", answer: true },
  { sub: "语文", type: "choice", q: "一（　）马", options: ["只", "头", "匹", "条"], answer: 2 },
  { sub: "语文", type: "choice", q: "“停车坐爱枫林晚”的下一句是？", options: ["霜叶红于二月花", "白云生处有人家", "远上寒山石径斜", "一枝红杏出墙来"], answer: 0 },
  { sub: "语文", type: "choice", q: "“闻”字的部首是？", options: ["耳", "门", "口", "日"], answer: 1 },
  { sub: "语文", type: "judge", q: "“重”是多音字", answer: true },
  { sub: "语文", type: "choice", q: "“美丽”的近义词是？", options: ["丑陋", "漂亮", "干净", "明亮"], answer: 1 },
  { sub: "语文", type: "fill", q: "量词填空：一（　）花", answer: ["朵", "束", "枝"] },
  { sub: "语文", type: "choice", q: "《山行》的作者是？", options: ["李白", "杜甫", "杜牧", "王维"], answer: 2 },
  { sub: "语文", type: "judge", q: "“白发三千丈”用了夸张的修辞手法", answer: true },
  { sub: "语文", type: "choice", q: "“银”字的正确读音是？", options: ["yín", "yíng", "yīn", "yǐn"], answer: 0 },
  { sub: "语文", type: "choice", q: "“仔细”的反义词是？", options: ["认真", "马虎", "细心", "用心"], answer: 1 },
  { sub: "语文", type: "fill", q: "成语补全：五（　）六色", answer: ["颜"] },
  { sub: "语文", type: "choice", q: "“湖”字的部首是？", options: ["古", "月", "氵", "胡"], answer: 2 },
  { sub: "语文", type: "judge", q: "问句的结尾要用问号", answer: true },
  { sub: "语文", type: "choice", q: "“欲把西湖比西子”的下一句是？", options: ["淡妆浓抹总相宜", "水光潋滟晴方好", "山色空蒙雨亦奇", "映日荷花别样红"], answer: 0 },
  { sub: "语文", type: "fill", q: "成语补全：百发百（　）", answer: ["中"] },
  { sub: "语文", type: "choice", q: "一（　）尺子", options: ["个", "把", "条", "只"], answer: 1 },
  { sub: "语文", type: "judge", q: "“爪”字只有一个读音", answer: false },
  { sub: "语文", type: "choice", q: "“萧萧梧叶送寒声”出自哪首诗？", options: ["《山行》", "《夜书所见》", "《望天门山》", "《静夜思》"], answer: 1 },

  // ==================== 英语 ====================
  { sub: "英语", type: "choice", q: "“apple”的意思是？", options: ["香蕉", "苹果", "橘子", "葡萄"], answer: 1 },
  { sub: "英语", type: "choice", q: "What colour is the sky on a sunny day?", options: ["Red", "Green", "Blue", "Black"], answer: 2 },
  { sub: "英语", type: "choice", q: "I （　） a student.", options: ["am", "is", "are", "be"], answer: 0 },
  { sub: "英语", type: "judge", q: "“dog”的意思是“猫”", answer: false },
  { sub: "英语", type: "choice", q: "one cat, two （　）", options: ["cat", "cats", "cates", "caties"], answer: 1 },
  { sub: "英语", type: "choice", q: "“早上好”用英语怎么说？", options: ["Good night", "Good afternoon", "Good morning", "Goodbye"], answer: 2 },
  { sub: "英语", type: "fill", q: "数字 7 的英文是（　）", answer: ["seven"] },
  { sub: "英语", type: "judge", q: "“banana”的意思是“香蕉”", answer: true },
  { sub: "英语", type: "choice", q: "She （　） my sister.", options: ["am", "is", "are", "be"], answer: 1 },
  { sub: "英语", type: "choice", q: "下面哪个是水果？", options: ["desk", "peach", "chair", "door"], answer: 1 },
  { sub: "英语", type: "fill", q: "颜色“红色”的英文是（　）", answer: ["red"] },
  { sub: "英语", type: "judge", q: "“Monday”是星期一", answer: true },
  { sub: "英语", type: "choice", q: "How old （　） you?", options: ["am", "is", "are", "be"], answer: 2 },
  { sub: "英语", type: "choice", q: "big 的反义词是？", options: ["small", "tall", "long", "fat"], answer: 0 },
  { sub: "英语", type: "choice", q: "This is （　） apple.", options: ["a", "an", "two", "the"], answer: 1 },
  { sub: "英语", type: "judge", q: "“eleven”是数字 12", answer: false },
  { sub: "英语", type: "choice", q: "“兔子”的英文是？", options: ["cat", "dog", "rabbit", "bird"], answer: 2 },
  { sub: "英语", type: "choice", q: "We （　） students.", options: ["am", "is", "are", "be"], answer: 2 },
  { sub: "英语", type: "fill", q: "“谢谢”用英语说是（　）", answer: ["thanks", "thank you", "thankyou"] },
  { sub: "英语", type: "choice", q: "What's this? — It's （　） egg.", options: ["a", "an", "two", "the"], answer: 1 },
];
