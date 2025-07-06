import { BacktestResult } from './types.js';

export class ReportGenerator {
  generateJSON(result: BacktestResult): string {
    // Format dates in the result for better readability
    const formattedResult = {
      ...result,
      config: {
        ...result.config,
        startDate: result.config.startDate?.toISOString(),
        endDate: result.config.endDate?.toISOString()
      }
    };
    
    return JSON.stringify(formattedResult, null, 2);
  }
  
  generateHTML(result: BacktestResult): string {
    // Format data for Chart.js
    const dates = result.equityCurve.map(p => {
      const d = new Date(p.timestamp);
      return `${d.getMonth() + 1}/${d.getDate()}`;
    });
    
    const values = result.equityCurve.map(p => p.value.toFixed(2));
    
    // Calculate some additional stats for display
    const annualizedReturn = (result.summary.totalReturn * 365 / result.summary.totalDays).toFixed(1);
    const avgWin = result.positions
      .filter(p => p.totalPnL > 0)
      .reduce((sum, p) => sum + p.totalPnL, 0) / (result.summary.winningTrades || 1);
    const avgLoss = result.positions
      .filter(p => p.totalPnL < 0)
      .reduce((sum, p) => sum + p.totalPnL, 0) / ((result.summary.numberOfTrades - result.summary.winningTrades) || 1);
    
    return `<!DOCTYPE html>
<html>
<head>
  <title>Delta-Neutral Backtest Results</title>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
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
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
    }
    
    h1 {
      text-align: center;
      margin-bottom: 30px;
      color: #2c3e50;
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
      transition: transform 0.2s;
    }
    
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 20px rgba(0,0,0,0.12);
    }
    
    .stat-value {
      font-size: 2.5em;
      font-weight: bold;
      margin-bottom: 10px;
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
    
    #equityChart {
      max-height: 400px;
    }
    
    .details {
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.08);
    }
    
    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid #ecf0f1;
    }
    
    .detail-row:last-child {
      border-bottom: none;
    }
    
    .footer {
      text-align: center;
      margin-top: 40px;
      color: #95a5a6;
      font-size: 0.9em;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🎯 Delta-Neutral Funding Arbitrage Backtest</h1>
    
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
          ${result.summary.winRate.toFixed(0)}%
        </div>
        <div class="stat-label">Win Rate</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value neutral">
          ${result.summary.numberOfTrades}
        </div>
        <div class="stat-label">Total Trades</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value negative">
          -${result.summary.maxDrawdown.toFixed(1)}%
        </div>
        <div class="stat-label">Max Drawdown</div>
      </div>
      
      <div class="stat-card">
        <div class="stat-value positive">
          $${result.summary.finalCapital.toFixed(0)}
        </div>
        <div class="stat-label">Final Capital</div>
      </div>
    </div>
    
    <div class="chart-container">
      <h2 style="margin-bottom: 20px; color: #2c3e50;">Portfolio Value Over Time</h2>
      <canvas id="equityChart"></canvas>
    </div>
    
    <div class="details">
      <h2 style="margin-bottom: 20px; color: #2c3e50;">Performance Details</h2>
      
      <div class="detail-row">
        <span>Initial Capital</span>
        <span>$${result.summary.initialCapital.toFixed(2)}</span>
      </div>
      
      <div class="detail-row">
        <span>Final Capital</span>
        <span>$${result.summary.finalCapital.toFixed(2)}</span>
      </div>
      
      <div class="detail-row">
        <span>Total Profit</span>
        <span class="${result.summary.totalReturnDollars >= 0 ? 'positive' : 'negative'}">
          ${result.summary.totalReturnDollars >= 0 ? '+' : ''}$${result.summary.totalReturnDollars.toFixed(2)}
        </span>
      </div>
      
      <div class="detail-row">
        <span>Average Win</span>
        <span class="positive">+$${avgWin.toFixed(2)}</span>
      </div>
      
      <div class="detail-row">
        <span>Average Loss</span>
        <span class="negative">$${avgLoss.toFixed(2)}</span>
      </div>
      
      <div class="detail-row">
        <span>Backtest Period</span>
        <span>${result.summary.totalDays} days</span>
      </div>
      
      <div class="detail-row">
        <span>Strategy</span>
        <span>Delta-Neutral (Long Spot + Short Perp)</span>
      </div>
      
      <div class="detail-row">
        <span>Min Funding APR</span>
        <span>${result.config.minAPR}%</span>
      </div>
    </div>
    
    <div class="footer">
      <p>Generated on ${new Date().toLocaleString()}</p>
      <p>Data source: Bybit historical funding rates and prices</p>
    </div>
  </div>
  
  <script>
    const ctx = document.getElementById('equityChart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(46, 204, 113, 0.2)');
    gradient.addColorStop(1, 'rgba(46, 204, 113, 0.01)');
    
    new Chart(ctx, {
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
            titleFont: {
              size: 14
            },
            bodyFont: {
              size: 16,
              weight: 'bold'
            },
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
  </script>
</body>
</html>`;
  }
}