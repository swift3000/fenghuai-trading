/**
 * 报告生成器
 * 生成多种格式的测试报告（JSON, Markdown, HTML）
 */

const fs = require('fs');
const path = require('path');

const projectRoot = '/Users/god/Desktop/项目/github/fenghuai-trading';

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(testResults) {
  const { startTime, endTime, pages, summary } = testResults;
  
  let md = `# 📊 自动化测试报告\n\n`;
  md += `**生成时间**: ${new Date().toLocaleString('zh-CN')}\n\n`;
  md += `---\n\n`;
  
  // 执行摘要
  md += `## 📈 执行摘要\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 总页面数 | ${summary.total} |\n`;
  md += `| 通过 | ${summary.passed} |\n`;
  md += `| 失败 | ${summary.failed} |\n`;
  md += `| 通过率 | ${summary.passRate} |\n`;
  md += `| 开始时间 | ${startTime} |\n`;
  md += `| 结束时间 | ${endTime} |\n\n`;
  
  // 详细结果
  md += `## 📝 详细结果\n\n`;
  pages.forEach(page => {
    md += `### ${page.name} (${page.route})\n\n`;
    md += `**状态**: ${page.status === 'passed' ? '✅ 通过' : '❌ 失败'}\n\n`;
    
    page.tests.forEach(test => {
      const icon = test.status === 'passed' ? '✅' : '❌';
      md += `- ${icon} ${test.name}\n`;
      if (test.error) {
        md += `  - 错误：${test.error}\n`;
      }
    });
    md += '\n';
  });
  
  // 错误汇总
  if (summary.errors.length > 0) {
    md += `## ⚠️ 错误汇总\n\n`;
    summary.errors.forEach((err, i) => {
      md += `${i + 1}. **${err.page}**: ${err.error}\n`;
    });
    md += '\n';
  }
  
  // 建议
  md += `## 💡 建议\n\n`;
  if (summary.failed === 0) {
    md += `✅ 所有测试通过，可以安全部署\n\n`;
  } else {
    md += `⚠️ 发现 ${summary.failed} 个失败项，建议：\n\n`;
    md += `1. 检查错误日志\n`;
    md += `2. 修复相关问题\n`;
    md += `3. 重新运行测试\n`;
  }
  
  return md;
}

/**
 * 生成 HTML 报告
 */
function generateHTMLReport(testResults) {
  const md = generateMarkdownReport(testResults);
  const { summary } = testResults;
  const passColor = summary.failed === 0 ? '#10b981' : '#f59e0b';
  
  const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>自动化测试报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      background: #f5f5f5;
      padding: 20px;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background: white;
      border-radius: 12px;
      padding: 40px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    h1 { color: #1a1a1a; margin-bottom: 20px; }
    h2 { color: #4a4a4a; margin: 30px 0 15px; border-bottom: 2px solid ${passColor}; padding-bottom: 10px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin: 20px 0;
    }
    .card {
      background: #f8f9fa;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    .card .value {
      font-size: 32px;
      font-weight: bold;
      color: ${passColor};
    }
    .card .label {
      color: #666;
      font-size: 14px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #ddd;
    }
    th { background: #f8f9fa; font-weight: 600; }
    .status-passed { color: #10b981; font-weight: bold; }
    .status-failed { color: #ef4444; font-weight: bold; }
    .page-section {
      margin: 20px 0;
      padding: 20px;
      background: #f8f9fa;
      border-radius: 8px;
    }
    .error-list {
      background: #fef2f2;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #ef4444;
    }
    .suggestion {
      background: #eff6ff;
      padding: 15px;
      border-radius: 8px;
      border-left: 4px solid #3b82f6;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 自动化测试报告</h1>
    <p><strong>生成时间</strong>: ${new Date().toLocaleString('zh-CN')}</p>
    
    <h2>📈 执行摘要</h2>
    <div class="summary">
      <div class="card">
        <div class="value">${summary.total}</div>
        <div class="label">总页面数</div>
      </div>
      <div class="card">
        <div class="value" style="color: #10b981">${summary.passed}</div>
        <div class="label">通过</div>
      </div>
      <div class="card">
        <div class="value" style="color: #ef4444">${summary.failed}</div>
        <div class="label">失败</div>
      </div>
      <div class="card">
        <div class="value" style="color: ${passColor}">${summary.passRate}</div>
        <div class="label">通过率</div>
      </div>
    </div>
    
    <h2>📝 详细结果</h2>
    ${testResults.pages.map(page => `
      <div class="page-section">
        <h3>${page.name} <small>(${page.route})</small></h3>
        <p><strong>状态</strong>: <span class="status-${page.status}">${page.status === 'passed' ? '✅ 通过' : '❌ 失败'}</span></p>
        <ul>
          ${page.tests.map(test => `
            <li>
              ${test.status === 'passed' ? '✅' : '❌'} ${test.name}
              ${test.error ? `<br><small style="color: #ef4444">错误：${test.error}</small>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `).join('')}
    
    ${testResults.summary.errors.length > 0 ? `
      <h2>⚠️ 错误汇总</h2>
      <div class="error-list">
        <ol>
          ${testResults.summary.errors.map(err => `
            <li><strong>${err.page}</strong>: ${err.error}</li>
          `).join('')}
        </ol>
      </div>
    ` : ''}
    
    <h2>💡 建议</h2>
    <div class="suggestion">
      ${summary.failed === 0 
        ? '✅ 所有测试通过，可以安全部署'
        : `⚠️ 发现 ${summary.failed} 个失败项，建议修复后重新测试`
      }
    </div>
  </div>
</body>
</html>`;
  
  return html;
}

/**
 * 生成完整报告
 */
function generateAllReports(testResults) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
  const reportDir = path.join(projectRoot, 'reports');
  
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }
  
  // JSON 报告
  const jsonPath = path.join(reportDir, `test-report-${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(testResults, null, 2));
  console.log(`📄 JSON 报告：${jsonPath}`);
  
  // Markdown 报告
  const md = generateMarkdownReport(testResults);
  const mdPath = path.join(reportDir, `test-report-${timestamp}.md`);
  fs.writeFileSync(mdPath, md);
  console.log(`📄 Markdown 报告：${mdPath}`);
  
  // HTML 报告
  const html = generateHTMLReport(testResults);
  const htmlPath = path.join(reportDir, `test-report-${timestamp}.html`);
  fs.writeFileSync(htmlPath, html);
  console.log(`📄 HTML 报告：${htmlPath}`);
  
  return { jsonPath, mdPath, htmlPath };
}

module.exports = { generateMarkdownReport, generateHTMLReport, generateAllReports };
