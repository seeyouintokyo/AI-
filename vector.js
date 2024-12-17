// 本地向量查询（简单实现）
function calculateSimilarity(text1, text2) {
    const words1 = new Set(text1.split(" "));
    const words2 = new Set(text2.split(" "));
    const intersection = new Set([...words1].filter(word => words2.has(word)));
    return intersection.size / Math.max(words1.size, words2.size);
}

// 使用 AI 生成文本向量
async function generateVector(text, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer sk-b496e3e7bb1b45958f8e4e731608442e"
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              "role": "user",
              "content": text
            }
          ],
          temperature: 0.7,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      if (data.choices && data.choices[0] && data.choices[0].message) {
        // 将返回的文本转换为简单的向量表示
        const text = data.choices[0].message.content;
        const words = text.split(/\s+/);
        return words;
      }
      throw new Error("Invalid response format");
    } catch (error) {
      console.error(`Attempt ${i + 1} failed:`, error);
      if (i === retries - 1) {
        console.log("Falling back to text-based similarity...");
        // 使用文本相似度作为后备方案
        return null;
      }
      // 等待一段时间后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
}

// 智能相似度计算：优先使用向量，失败时回退到文本
async function calculateSmart(text1, text2) {
  try {
    const vector1 = await generateVector(text1);
    const vector2 = await generateVector(text2);
    
    if (vector1 && vector2) {
      return calculateCosineSimilarity(vector1, vector2);
    } else {
      // 如果向量生成失败，回退到文本相似度
      return calculateSimilarity(text1, text2);
    }
  } catch (error) {
    console.error("Error in smart calculation:", error);
    return calculateSimilarity(text1, text2);
  }
}

// 计算两个向量的余弦相似度
function calculateCosineSimilarity(vector1, vector2) {
  if (!vector1 || !vector2 || vector1.length !== vector2.length) {
    return 0;
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vector1.length; i++) {
    dotProduct += vector1[i] * vector2[i];
    norm1 += vector1[i] * vector1[i];
    norm2 += vector2[i] * vector2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

// 导出函数供其他模块使用
export { generateVector, calculateCosineSimilarity, calculateSmart };