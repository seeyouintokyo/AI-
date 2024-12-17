// 简单的本地 NLP 提取关键信息
function extractKeywords(text) {
  return text.split(" ").filter(word => word.length > 2);
}