#!/bin/bash

# 设置版本号
VERSION="1.1"
EXTENSION_NAME="axing-ai-bookmarks"
OUTPUT_NAME="${EXTENSION_NAME}-v${VERSION}"

# 创建临时目录
TMP_DIR="/tmp/${OUTPUT_NAME}"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR"

# 要复制的文件列表
FILES=(
    "manifest.json"
    "background.js"
    "content.js"
    "popup.html"
    "popup.js"
    "config.js"
    "omnibox.js"
    "icon.png"
    "README.md"
    "nlp.js"
    "vector.js"
)

# 复制必要文件到临时目录
for file in "${FILES[@]}"; do
    cp "$file" "$TMP_DIR/"
done

# 创建 zip 文件
cd "/tmp"
rm -f "${OUTPUT_NAME}.zip"
zip -r "${OUTPUT_NAME}.zip" "${OUTPUT_NAME}/"

# 移动 zip 文件到原目录
mv "${OUTPUT_NAME}.zip" "$(dirname "$0")"

# 清理临时目录
rm -rf "$TMP_DIR"

echo "打包完成: ${OUTPUT_NAME}.zip"
echo "提示：请在 Chrome 扩展管理页面，选择'加载已解压的扩展程序'来安装。"
