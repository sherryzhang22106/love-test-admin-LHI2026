import React, { useState, useEffect } from 'react';
import { adminApi, ProductType } from './services/adminApi';

interface DashboardProps {
  admin: { id: string; email: string; name: string };
  onLogout: () => void;
}

type Tab = 'overview' | 'assessments' | 'codes';

const PRODUCT_LABELS: Record<ProductType, string> = {
  LHI: '爱情健康指数 (LHI)',
  LCI: '爱情浓度指数 (LCI)',
  ASA: '依恋风格测评 (ASA)',
  ALL: '通用兑换码',
};

// 饼图颜色配置
const PIE_COLORS = ['#8b5cf6', '#ec4899', '#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

const Dashboard: React.FC<DashboardProps> = ({ admin, onLogout }) => {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [selectedProduct, setSelectedProduct] = useState<ProductType | undefined>(undefined);
  const [stats, setStats] = useState<any>(null);
  const [codeStats, setCodeStats] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [codes, setCodes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generateCount, setGenerateCount] = useState(10);
  const [generateProductType, setGenerateProductType] = useState<ProductType>('LHI');
  const [newlyGeneratedCodes, setNewlyGeneratedCodes] = useState<any[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  // Sync generateProductType with selectedProduct filter
  useEffect(() => {
    if (selectedProduct && selectedProduct !== 'ALL') {
      setGenerateProductType(selectedProduct);
    }
  }, [selectedProduct]);

  useEffect(() => {
    loadData();
  }, [activeTab, selectedProduct]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [statsData, codeStatsData] = await Promise.all([
          adminApi.getStatistics(selectedProduct),
          adminApi.getCodeStats(selectedProduct),
        ]);
        setStats(statsData);
        setCodeStats(codeStatsData);
      } else if (activeTab === 'assessments') {
        const data = await adminApi.listAssessments(1, 20, selectedProduct);
        setAssessments(data.assessments);
      } else if (activeTab === 'codes') {
        const data = await adminApi.listCodes(1, 50, 'all', selectedProduct);
        setCodes(data.codes);
        const codeStatsData = await adminApi.getCodeStats(selectedProduct);
        setCodeStats(codeStatsData);
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateCodes = async () => {
    try {
      const result = await adminApi.generateCodes(generateCount, generateProductType);
      alert(`成功生成 ${generateCount} 个 ${PRODUCT_LABELS[generateProductType]} 兑换码！`);

      if (result && result.codes) {
        setNewlyGeneratedCodes(result.codes);
      }

      loadData();
    } catch (error) {
      alert('生成兑换码失败');
    }
  };

  const handleExportCodes = () => {
    if (newlyGeneratedCodes.length === 0) {
      alert('没有可导出的兑换码，请先生成新的兑换码');
      return;
    }

    const headers = ['兑换码', '产品类型', '批次ID', '生成时间', '状态'];
    const rows = newlyGeneratedCodes.map(code => [
      code.code,
      code.productType || 'LHI',
      code.batchId,
      new Date(code.createdAt).toLocaleString('zh-CN'),
      code.isUsed ? '已使用' : '未使用'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `兑换码_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // 导出评估数据
  const handleExportAssessments = async () => {
    setIsExporting(true);
    try {
      const result = await adminApi.exportAssessments(selectedProduct);
      if (result.success && result.data) {
        const headers = ['评估ID', '产品类型', '分数', '类别', '依恋风格', '兑换码', '创建时间'];
        const rows = result.data.map((item: any) => [
          item.id,
          item.productType,
          item.totalScore,
          item.category,
          item.attachmentStyle || '-',
          item.accessCode || '-',
          new Date(item.createdAt).toLocaleString('zh-CN')
        ]);

        const csvContent = [
          headers.join(','),
          ...rows.map((row: string[]) => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        const BOM = '\uFEFF';
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);

        const productLabel = selectedProduct || '全部';
        link.setAttribute('href', url);
        link.setAttribute('download', `评估数据_${productLabel}_${new Date().toLocaleDateString('zh-CN').replace(/\//g, '-')}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert(`成功导出 ${result.count} 条评估记录！`);
      }
    } catch (error) {
      alert('导出失败，请重试');
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
              <span className="text-white text-xl">📊</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-800">爱情测试管理后台</h1>
              <p className="text-xs text-slate-500">{admin.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        {/* Product Type Filter */}
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-medium text-slate-600">筛选产品：</span>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedProduct(undefined)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                selectedProduct === undefined
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              全部
            </button>
            {(['LHI', 'LCI', 'ASA'] as ProductType[]).map((pt) => (
              <button
                key={pt}
                onClick={() => setSelectedProduct(pt)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedProduct === pt
                    ? pt === 'LHI'
                      ? 'bg-purple-500 text-white'
                      : 'bg-pink-500 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {pt}
              </button>
            ))}
          </div>
        </div>

        <div className="flex gap-2 mb-6 bg-white p-2 rounded-lg shadow-sm">
          {[
            { id: 'overview', label: '数据概览', icon: '📈' },
            { id: 'assessments', label: '评估记录', icon: '📝' },
            { id: 'codes', label: '兑换码管理', icon: '🔑' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as Tab)}
              className={`flex-1 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
            <p className="mt-4 text-slate-500">加载中...</p>
          </div>
        ) : (
          <>
            {activeTab === 'overview' && stats && codeStats && (
              <div className="space-y-6">
                {/* 导出按钮 */}
                <div className="flex justify-end">
                  <button
                    onClick={handleExportAssessments}
                    disabled={isExporting}
                    className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50"
                  >
                    {isExporting ? '导出中...' : '📥 导出评估数据'}
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <StatCard title="评估总数" value={stats.total} icon="📊" color="blue" />
                  <StatCard title="平均分数" value={stats.avgScore} icon="⭐" color="green" />
                  <StatCard title="可用兑换码" value={codeStats.available} icon="🔑" color="purple" />
                  <StatCard title="已用兑换码" value={codeStats.used} icon="✅" color="pink" />
                </div>

                {/* 30天趋势图表 */}
                {stats.dailyStats && stats.dailyStats.length > 0 && (
                  <div className="bg-white rounded-xl shadow-sm p-6">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">📈 30天测评趋势</h3>
                    <div className="h-48 flex items-end gap-1">
                      {stats.dailyStats.slice(-14).map((day: any, index: number) => {
                        const maxCount = Math.max(...stats.dailyStats.slice(-14).map((d: any) => d.count), 1);
                        const heightPercent = (day.count / maxCount) * 100;
                        const barHeight = Math.max(heightPercent, day.count > 0 ? 8 : 2);
                        return (
                          <div key={day.date} className="flex-1 flex flex-col items-center group h-full">
                            <div className="flex-1 w-full flex flex-col justify-end items-center">
                              <span className="text-xs text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity mb-1">
                                {day.count}
                              </span>
                              <div
                                className="w-full bg-gradient-to-t from-purple-500 to-pink-400 rounded-t-sm transition-all hover:from-purple-600 hover:to-pink-500"
                                style={{ height: `${barHeight}%`, minHeight: day.count > 0 ? '8px' : '2px' }}
                                title={`${day.date}: ${day.count}次测评`}
                              />
                            </div>
                            <span className="text-xs text-slate-400 mt-1 transform -rotate-45 origin-left whitespace-nowrap">
                              {day.date.slice(5)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-4 flex gap-4 text-sm text-slate-600">
                      <span>最近14天总测评: <strong className="text-purple-600">
                        {stats.dailyStats.slice(-14).reduce((sum: number, d: any) => sum + d.count, 0)}
                      </strong></span>
                      <span>日均: <strong className="text-pink-600">
                        {(stats.dailyStats.slice(-14).reduce((sum: number, d: any) => sum + d.count, 0) / 14).toFixed(1)}
                      </strong></span>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
                    <div className="text-blue-600 font-semibold">最低分数</div>
                    <div className="text-3xl font-bold text-blue-700 mt-2">{stats.minScore}</div>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
                    <div className="text-purple-600 font-semibold">平均分数</div>
                    <div className="text-3xl font-bold text-purple-700 mt-2">{stats.avgScore}</div>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
                    <div className="text-green-600 font-semibold">最高分数</div>
                    <div className="text-3xl font-bold text-green-700 mt-2">{stats.maxScore}</div>
                  </div>
                </div>

                {/* 分布图表（饼图可视化） */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* LHI Category Distribution */}
                  {stats.lhiCategoryDistribution && stats.lhiCategoryDistribution.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">💜 LHI类别分布</h3>
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-28 h-28">
                          <PieChart data={stats.lhiCategoryDistribution.map((item: any) => item.count)} />
                        </div>
                        <div className="w-full space-y-2">
                          {stats.lhiCategoryDistribution.map((item: any, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                              />
                              <span className="text-sm text-slate-600 truncate">{item.category}</span>
                              <span className="ml-auto font-bold text-slate-800">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* LCI Category Distribution */}
                  {stats.lciCategoryDistribution && stats.lciCategoryDistribution.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">💗 LCI类别分布</h3>
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-28 h-28">
                          <PieChart data={stats.lciCategoryDistribution.map((item: any) => item.count)} />
                        </div>
                        <div className="w-full space-y-2">
                          {stats.lciCategoryDistribution.map((item: any, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                              />
                              <span className="text-sm text-slate-600 truncate">{item.category}</span>
                              <span className="ml-auto font-bold text-slate-800">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* ASA Attachment Distribution */}
                  {stats.attachmentDistribution && stats.attachmentDistribution.length > 0 && (
                    <div className="bg-white rounded-xl shadow-sm p-6">
                      <h3 className="text-lg font-bold text-slate-800 mb-4">🔷 ASA依恋风格分布</h3>
                      <div className="flex flex-col items-center gap-4">
                        <div className="relative w-28 h-28">
                          <PieChart data={stats.attachmentDistribution.map((item: any) => item.count)} />
                        </div>
                        <div className="w-full space-y-2">
                          {stats.attachmentDistribution.map((item: any, index: number) => (
                            <div key={index} className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: PIE_COLORS[index % PIE_COLORS.length] }}
                              />
                              <span className="text-sm text-slate-600 truncate">{item.style}</span>
                              <span className="ml-auto font-bold text-slate-800">{item.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">最近评估</h3>
                  {stats.recentAssessments && stats.recentAssessments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50">
                          <tr>
                            <th className="px-4 py-3 text-left text-slate-600 font-medium">产品</th>
                            <th className="px-4 py-3 text-left text-slate-600 font-medium">分数</th>
                            <th className="px-4 py-3 text-left text-slate-600 font-medium">类别</th>
                            <th className="px-4 py-3 text-left text-slate-600 font-medium">依恋风格</th>
                            <th className="px-4 py-3 text-left text-slate-600 font-medium">AI报告</th>
                            <th className="px-4 py-3 text-left text-slate-600 font-medium">日期</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stats.recentAssessments.map((assessment: any) => (
                            <tr key={assessment.id} className="border-t border-slate-100 hover:bg-slate-50">
                              <td className="px-4 py-3">
                                <span className={`px-2 py-1 rounded text-xs font-medium ${
                                  assessment.productType === 'LHI' ? 'bg-purple-100 text-purple-700' :
                                  assessment.productType === 'LCI' ? 'bg-pink-100 text-pink-700' :
                                  assessment.productType === 'ASA' ? 'bg-blue-100 text-blue-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {assessment.productType || 'LHI'}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-bold text-purple-600">{assessment.totalScore}</td>
                              <td className="px-4 py-3 text-slate-700">{assessment.category || '-'}</td>
                              <td className="px-4 py-3 text-slate-600 text-xs">{assessment.attachmentStyle || '-'}</td>
                              <td className="px-4 py-3">
                                {assessment.aiAnalysis ? (
                                  <button
                                    onClick={() => {
                                      const win = window.open('', '_blank');
                                      if (win) {
                                        win.document.write(`
                                          <html>
                                            <head>
                                              <title>AI报告 - ${assessment.id.slice(0,8)}</title>
                                              <style>
                                                body { font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; }
                                                h2, h3 { color: #6b21a8; }
                                              </style>
                                            </head>
                                            <body>
                                              <h2>AI深度分析报告</h2>
                                              <p><strong>产品:</strong> ${assessment.productType} | <strong>分数:</strong> ${assessment.totalScore}</p>
                                              <hr/>
                                              <div>${assessment.aiAnalysis.replace(/\n/g, '<br/>')}</div>
                                            </body>
                                          </html>
                                        `);
                                        win.document.close();
                                      }
                                    }}
                                    className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                                  >
                                    查看报告
                                  </button>
                                ) : (
                                  <span className="text-slate-400 text-xs">无</span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-500 text-xs">
                                {new Date(assessment.createdAt).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-slate-500">暂无评估数据</div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'assessments' && (
              <div className="bg-white rounded-xl shadow-sm p-6">
                <h3 className="text-lg font-bold text-slate-800 mb-4">所有评估记录</h3>
                {assessments.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">评估ID</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">分数</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">类别</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">兑换码</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">AI报告</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">评估日期</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assessments.map((assessment) => (
                          <tr key={assessment.id} className="border-t border-slate-100 hover:bg-slate-50">
                            <td className="px-4 py-3 text-slate-500 text-xs font-mono">{assessment.id.slice(0, 8)}</td>
                            <td className="px-4 py-3 font-bold text-purple-600">{assessment.totalScore}</td>
                            <td className="px-4 py-3 text-slate-700">{assessment.category}</td>
                            <td className="px-4 py-3 text-xs font-mono text-slate-600">{assessment.accessCode?.code || '-'}</td>
                            <td className="px-4 py-3">
                              {assessment.aiAnalysis ? (
                                <button
                                  onClick={() => {
                                    const win = window.open('', '_blank');
                                    if (win) {
                                      win.document.write(`
                                        <html>
                                          <head>
                                            <title>AI报告 - ${assessment.id.slice(0,8)}</title>
                                            <style>
                                              body { font-family: system-ui; padding: 40px; max-width: 800px; margin: 0 auto; line-height: 1.8; }
                                              h2, h3 { color: #6b21a8; }
                                            </style>
                                          </head>
                                          <body>
                                            <h2>AI深度分析报告</h2>
                                            <p><strong>评估ID:</strong> ${assessment.id.slice(0,8)} | <strong>分数:</strong> ${assessment.totalScore}</p>
                                            <hr/>
                                            <div>${typeof assessment.aiAnalysis === 'string' ? assessment.aiAnalysis.replace(/\\n/g, '<br/>') : JSON.stringify(assessment.aiAnalysis)}</div>
                                          </body>
                                        </html>
                                      `);
                                      win.document.close();
                                    }
                                  }}
                                  className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs hover:bg-green-200 transition-colors"
                                >
                                  查看报告
                                </button>
                              ) : (
                                <span className="text-slate-400 text-xs">无</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {new Date(assessment.createdAt).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="text-5xl mb-4">📭</div>
                    <div className="text-slate-500">暂无评估记录</div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'codes' && codeStats && (
              <div className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">生成兑换码</h3>
                  <div className="flex flex-wrap gap-4 items-center">
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={generateCount}
                      onChange={(e) => setGenerateCount(parseInt(e.target.value))}
                      className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none w-24"
                      placeholder="数量"
                    />
                    <select
                      value={generateProductType}
                      onChange={(e) => setGenerateProductType(e.target.value as ProductType)}
                      className="px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none"
                    >
                      <option value="LHI">LHI - 爱情健康指数</option>
                      <option value="LCI">LCI - 爱情浓度指数</option>
                      <option value="ASA">ASA - 依恋风格测评</option>
                      <option value="ALL">通用 - 所有产品</option>
                    </select>
                    <button
                      onClick={handleGenerateCodes}
                      className="px-6 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                    >
                      生成兑换码
                    </button>
                    {newlyGeneratedCodes.length > 0 && (
                      <button
                        onClick={handleExportCodes}
                        className="px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg font-medium hover:shadow-lg transition-all"
                      >
                        导出兑换码 ({newlyGeneratedCodes.length})
                      </button>
                    )}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-sm">
                    <span className="text-slate-600">总数: <strong>{codeStats.total}</strong></span>
                    <span className="text-green-600">可用: <strong>{codeStats.available}</strong></span>
                    <span className="text-slate-400">已用: <strong>{codeStats.used}</strong></span>
                    {codeStats.byProduct && (
                      <>
                        <span className="text-purple-600">LHI: <strong>{codeStats.byProduct.LHI?.available || 0}</strong></span>
                        <span className="text-pink-600">LCI: <strong>{codeStats.byProduct.LCI?.available || 0}</strong></span>
                      </>
                    )}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm p-6">
                  <h3 className="text-lg font-bold text-slate-800 mb-4">兑换码列表</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">兑换码</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">产品</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">状态</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">批次</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">生成时间</th>
                          <th className="px-4 py-3 text-left text-slate-600 font-medium">使用时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {codes.map((code) => (
                          <tr key={code.id} className="border-t border-slate-100">
                            <td className="px-4 py-3 font-mono font-bold text-purple-600">{code.code}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-1 rounded text-xs font-medium ${
                                code.productType === 'LHI' ? 'bg-purple-100 text-purple-700' :
                                code.productType === 'LCI' ? 'bg-pink-100 text-pink-700' :
                                'bg-slate-100 text-slate-700'
                              }`}>
                                {code.productType || 'LHI'}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {code.isUsed ? (
                                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs">已使用</span>
                              ) : (
                                <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs">未使用</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-slate-600 text-xs">{code.batchId}</td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {code.createdAt ? new Date(code.createdAt).toLocaleString('zh-CN') : '-'}
                            </td>
                            <td className="px-4 py-3 text-slate-500 text-xs">
                              {code.usedAt ? new Date(code.usedAt).toLocaleString('zh-CN') : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

const StatCard: React.FC<{ title: string; value: number; icon: string; color: string }> = ({
  title,
  value,
  icon,
  color,
}) => {
  const colors: Record<string, string> = {
    blue: 'from-blue-500 to-cyan-500',
    green: 'from-green-500 to-emerald-500',
    purple: 'from-purple-500 to-pink-500',
    pink: 'from-pink-500 to-rose-500',
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 border border-slate-100">
      <div className="flex items-center justify-between mb-3">
        <span className="text-2xl">{icon}</span>
        <div className={`w-12 h-12 rounded-lg bg-gradient-to-br ${colors[color]} opacity-10`}></div>
      </div>
      <div className="text-3xl font-bold text-slate-800 mb-1">{value}</div>
      <div className="text-sm text-slate-500">{title}</div>
    </div>
  );
};

// 简单的CSS饼图组件
const PieChart: React.FC<{ data: number[] }> = ({ data }) => {
  const total = data.reduce((sum, val) => sum + val, 0);
  if (total === 0) return <div className="w-full h-full rounded-full bg-slate-200" />;

  let cumulativePercent = 0;
  const segments = data.map((value, index) => {
    const percent = (value / total) * 100;
    const startPercent = cumulativePercent;
    cumulativePercent += percent;
    return { percent, startPercent, color: PIE_COLORS[index % PIE_COLORS.length] };
  });

  // 创建conic-gradient
  const gradientStops = segments.map((seg, i) => {
    const start = seg.startPercent;
    const end = seg.startPercent + seg.percent;
    return `${seg.color} ${start}% ${end}%`;
  }).join(', ');

  return (
    <div
      className="w-full h-full rounded-full"
      style={{
        background: `conic-gradient(${gradientStops})`
      }}
    />
  );
};

export default Dashboard;
