import { ComprehensiveBacktestResult, SymbolStats } from './types';

export class ComprehensiveReportGenerator {
  
  generateJSON(result: ComprehensiveBacktestResult): string {
    // Convert Map to object for JSON serialization
    const symbolStatsObj: Record<string, SymbolStats> = {};
    for (const [symbol, stats] of result.symbolStats) {
      symbolStatsObj[symbol] = stats;
    }
    
    const formattedResult = {
      ...result,
      config: {
        ...result.config,
        startDate: result.config.startDate?.toISOString(),
        endDate: result.config.endDate?.toISOString()
      },
      symbolStats: symbolStatsObj
    };
    
    return JSON.stringify(formattedResult, null, 2);
  }
  
  generateHTML(result: ComprehensiveBacktestResult): string {
    // Format data for charts
    const dates = result.equityCurve.map(p => {
      const d = new Date(p.timestamp);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    
    const values = result.equityCurve.map(p => p.value.toFixed(2));
    
    // Calculate additional metrics
    const annualizedReturn = (result.summary.totalReturn * 365 / result.summary.totalDays).toFixed(1);
    const totalFundingCollected = result.detailedPositions.reduce((sum, p) => sum + p.totalFunding, 0);
    const totalFees = result.detailedPositions.reduce((sum, p) => sum + p.entryFees + p.exitFees, 0);
    
    // Find best and worst trades
    const sortedByPnL = [...result.detailedPositions].sort((a, b) => b.totalPnL - a.totalPnL);
    const bestTrades = sortedByPnL.slice(0, 5);
    const worstTrades = sortedByPnL.slice(-5).reverse();
    
    // Generate trade rows
    const tradeRows = result.detailedPositions.map(p => {
      const entryDate = new Date(p.entryTime);
      return `
        <tr>
          <td>${entryDate.toLocaleDateString()}</td>
          <td>${p.symbol}</td>
          <td>${p.entryFundingAPR.toFixed(1)}%</td>
          <td>${p.exitFundingAPR.toFixed(1)}%</td>
          <td>${p.holdingPeriodHours.toFixed(1)}</td>
          <td>${p.fundingPeriodsHeld}</td>
          <td class="${p.totalFunding >= 0 ? 'positive' : 'negative'}">$${p.totalFunding.toFixed(2)}</td>
          <td class="${p.totalPnL >= 0 ? 'positive' : 'negative'}">$${p.totalPnL.toFixed(2)}</td>
          <td>${p.exitReason}</td>
        </tr>
      `;
    }).join('');
    
    // Generate monthly stats table
    const monthlyRows = result.monthlyStats.map(m => `
      <tr>
        <td>${m.month}</td>
        <td>${m.trades}</td>
        <td class="${m.profit >= 0 ? 'positive' : 'negative'}">$${m.profit.toFixed(2)}</td>
        <td class="${m.return >= 0 ? 'positive' : 'negative'}">${m.return.toFixed(1)}%</td>
        <td>${m.winRate.toFixed(0)}%</td>
      </tr>
    `).join('');
    
    // Generate symbol stats table
    const symbolRows = Array.from(result.symbolStats.values())
      .sort((a, b) => b.totalPnL - a.totalPnL)
      .map(s => `
        <tr>
          <td>${s.symbol}</td>
          <td>${s.trades}</td>
          <td class="${s.totalPnL >= 0 ? 'positive' : 'negative'}">$${s.totalPnL.toFixed(2)}</td>
          <td class="${s.avgPnL >= 0 ? 'positive' : 'negative'}">$${s.avgPnL.toFixed(2)}</td>
          <td>${s.winRate.toFixed(0)}%</td>
          <td>${s.avgFundingAPR.toFixed(1)}%</td>
          <td>$${s.totalFunding.toFixed(2)}</td>
        </tr>
      `).join('');
    
    // Monthly chart data
    const monthlyLabels = result.monthlyStats.map(m => m.month);
    const monthlyProfits = result.monthlyStats.map(m => m.profit.toFixed(2));
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Comprehensive Backtest Analysis</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <link rel="stylesheet" href="https://cdn.datatables.net/1.10.24/css/jquery.dataTables.min.css">
  <script src="https://code.jquery.com/jquery-3.6.0.min.js"></script>
  <script src="https://cdn.datatables.net/1.10.24/js/jquery.dataTables.min.js"></script>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
      padding: 20px;
      line-height: 1.6;
    }
    
    .container {
      max-width: 1400px;
      margin: 0 auto;
    }
    
    h1, h2 {
      color: #2c3e50;
      margin-bottom: 20px;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 40px;
      font-size: 2.5em;
    }
    
    h2 {
      margin-top: 40px;
      border-bottom: 2px solid #3498db;
      padding-bottom: 10px;
    }
    
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .stat-card {
      background: white;
      padding: 25px;
      border-radius: 12px;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }
    
    .stat-value {
      font-size: 2.2em;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .stat-label {
      color: #7f8c8d;
      font-size: 0.9em;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    
    .positive { color: #27ae60; }
    .negative { color: #e74c3c; }
    .neutral { color: #3498db; }
    
    .chart-container {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      margin-bottom: 40px;
    }
    
    .chart-container canvas {
      max-height: 400px;
    }
    
    .table-section {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
      margin-bottom: 40px;
      overflow-x: auto;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th {
      background: #34495e;
      color: white;
      padding: 12px;
      text-align: left;
      font-weight: 600;
    }
    
    td {
      padding: 10px 12px;
      border-bottom: 1px solid #ecf0f1;
    }
    
    tr:hover {
      background: #f8f9fa;
    }
    
    .detail-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 20px;
      margin-bottom: 40px;
    }
    
    .detail-card {
      background: white;
      padding: 20px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #ecf0f1;
    }
    
    .detail-row:last-child {
      border-bottom: none;
    }
    
    .info-box {
      background: #ecf0f1;
      padding: 15px;
      border-radius: 8px;
      margin: 20px 0;
    }
    
    .footer {
      text-align: center;
      margin-top: 60px;
      color: #95a5a6;
      font-size: 0.9em;
    }
    
    @media print {
      body {
        background: white;
      }
      .chart-container, .table-section, .detail-card {
        box-shadow: none;
        break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Comprehensive Delta-Neutral Backtest Analysis</h1>
    
    <!-- Executive Summary -->
    <div class="summary">
      <div class="stat-card">
        <div class="stat-value ${result.summary.totalReturn >= 0 ? 'positive' : 'negative'}">
          ${result.summary.totalReturn >= 0 ? '+' : ''}${result.summary.totalReturn.toFixed(1)}%
        </div>
        <div class="stat-label">Total Return</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value positive">
          ${annualizedReturn}%
        </div>
        <div class="stat-label">Annualized</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value neutral">
          ${result.summary.numberOfTrades}
        </div>
        <div class="stat-label">Total Trades</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value neutral">
          ${result.summary.winRate.toFixed(0)}%
        </div>
        <div class="stat-label">Win Rate</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value negative">
          -${result.summary.maxDrawdown.toFixed(1)}%
        </div>
        <div class="stat-label">Max Drawdown</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value positive">
          $${totalFundingCollected.toFixed(0)}
        </div>
        <div class="stat-label">Funding Collected</div>
      </div>
    </div>
    
    <!-- Performance Charts -->
    <h2>📈 Performance Analysis</h2>
    
    <div class="chart-container">
      <h3>Equity Curve</h3>
      <canvas id="equityChart"></canvas>
    </div>
    
    <div class="chart-container">
      <h3>Monthly Performance</h3>
      <canvas id="monthlyChart"></canvas>
    </div>
    
    <!-- Monthly Breakdown -->
    <h2>📅 Monthly Breakdown</h2>
    <div class="table-section">
      <table>
        <thead>
          <tr>
            <th>Month</th>
            <th>Trades</th>
            <th>Profit</th>
            <th>Return</th>
            <th>Win Rate</th>
          </tr>
        </thead>
        <tbody>
          ${monthlyRows}
        </tbody>
      </table>
    </div>
    
    <!-- Symbol Performance -->
    <h2>💎 Performance by Symbol</h2>
    <div class="table-section">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Trades</th>
            <th>Total P&L</th>
            <th>Avg P&L</th>
            <th>Win Rate</th>
            <th>Avg Entry APR</th>
            <th>Funding Collected</th>
          </tr>
        </thead>
        <tbody>
          ${symbolRows}
        </tbody>
      </table>
    </div>
    
    <!-- P&L Breakdown -->
    <h2>💰 P&L Analysis</h2>
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Revenue Sources</h3>
        <div class="detail-row">
          <span>Funding Collected</span>
          <span class="positive">+$${totalFundingCollected.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span>Spot P&L</span>
          <span>$${result.detailedPositions.reduce((sum, p) => sum + p.spotPnL, 0).toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span>Perp P&L</span>
          <span>$${result.detailedPositions.reduce((sum, p) => sum + p.perpPnL, 0).toFixed(2)}</span>
        </div>
      </div>
      
      <div class="detail-card">
        <h3>Costs</h3>
        <div class="detail-row">
          <span>Trading Fees</span>
          <span class="negative">-$${totalFees.toFixed(2)}</span>
        </div>
        <div class="detail-row">
          <span>Average Fee per Trade</span>
          <span class="negative">-$${(totalFees / result.summary.numberOfTrades).toFixed(2)}</span>
        </div>
      </div>
    </div>
    
    <!-- Top Trades -->
    <h2>🏆 Best & Worst Trades</h2>
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Top 5 Best Trades</h3>
        ${bestTrades.map(t => `
          <div class="detail-row">
            <span>${t.symbol} (${t.holdingPeriodHours.toFixed(0)}h)</span>
            <span class="positive">+$${t.totalPnL.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
      
      <div class="detail-card">
        <h3>Top 5 Worst Trades</h3>
        ${worstTrades.map(t => `
          <div class="detail-row">
            <span>${t.symbol} (${t.holdingPeriodHours.toFixed(0)}h)</span>
            <span class="negative">$${t.totalPnL.toFixed(2)}</span>
          </div>
        `).join('')}
      </div>
    </div>
    
    <!-- All Trades Table -->
    <h2>📊 All Trades (${result.detailedPositions.length})</h2>
    <div class="table-section">
      <table id="tradesTable">
        <thead>
          <tr>
            <th>Entry Date</th>
            <th>Symbol</th>
            <th>Entry APR</th>
            <th>Exit APR</th>
            <th>Hours Held</th>
            <th>Funding Periods</th>
            <th>Funding Collected</th>
            <th>Net P&L</th>
            <th>Exit Reason</th>
          </tr>
        </thead>
        <tbody>
          ${tradeRows}
        </tbody>
      </table>
    </div>
    
    <!-- Strategy Information -->
    <div class="info-box">
      <h3>Strategy Configuration</h3>
      <p><strong>Initial Capital:</strong> $${result.config.initialCapital?.toLocaleString()}</p>
      <p><strong>Minimum Funding APR:</strong> ${result.config.minAPR}%</p>
      <p><strong>Backtest Period:</strong> ${result.summary.totalDays} days</p>
      <p><strong>Start Date:</strong> ${result.config.startDate ? new Date(result.config.startDate).toLocaleDateString() : 'N/A'}</p>
      <p><strong>End Date:</strong> ${result.config.endDate ? new Date(result.config.endDate).toLocaleDateString() : 'N/A'}</p>
    </div>
    
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>Delta-Neutral Funding Arbitrage Strategy | Comprehensive Backtest Report</p>
    </div>
  </div>
  
  <script>
    // Equity Chart
    const ctx1 = document.getElementById('equityChart').getContext('2d');
    const gradient = ctx1.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(46, 204, 113, 0.2)');
    gradient.addColorStop(1, 'rgba(46, 204, 113, 0.01)');
    
    new Chart(ctx1, {
      type: 'line',
      data: {
        labels: ${JSON.stringify(dates)},
        datasets: [{
          label: 'Portfolio Value ($)',
          data: ${JSON.stringify(values)},
          borderColor: '#2ecc71',
          backgroundColor: gradient,
          borderWidth: 3,
          fill: true,
          tension: 0.1,
          pointRadius: 0,
          pointHoverRadius: 6,
          pointBackgroundColor: '#2ecc71'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            cornerRadius: 8,
            callbacks: {
              label: function(context) {
                return '$' + context.formattedValue;
              }
            }
          }
        },
        scales: {
          x: {
            grid: {
              display: false
            },
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 10
            }
          },
          y: {
            beginAtZero: false,
            grid: {
              color: '#f0f0f0'
            },
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
    
    // Monthly Chart
    const ctx2 = document.getElementById('monthlyChart').getContext('2d');
    new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ${JSON.stringify(monthlyLabels)},
        datasets: [{
          label: 'Monthly Profit ($)',
          data: ${JSON.stringify(monthlyProfits)},
          backgroundColor: function(context) {
            const value = context.parsed.y;
            return value >= 0 ? 'rgba(46, 204, 113, 0.8)' : 'rgba(231, 76, 60, 0.8)';
          },
          borderColor: function(context) {
            const value = context.parsed.y;
            return value >= 0 ? '#27ae60' : '#e74c3c';
          },
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                return '$' + context.formattedValue;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: '#f0f0f0'
            },
            ticks: {
              callback: function(value) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      }
    });
    
    // Initialize DataTable
    $(document).ready(function() {
      $('#tradesTable').DataTable({
        pageLength: 25,
        order: [[0, 'desc']],
        columnDefs: [
          { targets: [2, 3, 4, 5, 6, 7], className: 'dt-right' }
        ]
      });
    });
  </script>
</body>
</html>`;
  }
}