// COVID-19 Dashboard JavaScript
class COVIDDashboard {
    constructor() {
        this.data = [];
        this.charts = {};
        // Initialize AI integration if available
        if (typeof DashScopeIntegration !== 'undefined') {
            this.initAI && this.initAI();
        }
        this.initializeEventListeners();
        this.loadSampleData();
    }

    initializeEventListeners() {
        // Navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.showSection(link.getAttribute('href').substring(1));
            });
        });

        // File upload
        document.getElementById('csvFile').addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files[0]);
        });

        // Analysis controls
        document.getElementById('analysisType').addEventListener('change', this.updateAnalysisControls.bind(this));
    }

    showSection(sectionId) {
        // Hide all sections
        document.querySelectorAll('section').forEach(section => {
            section.style.display = 'none';
        });

        // Show selected section
        document.getElementById(sectionId).style.display = 'block';

        // Update navigation
        document.querySelectorAll('.nav-link').forEach(link => {
            link.classList.remove('active');
        });
        document.querySelector(`[href="#${sectionId}"]`).classList.add('active');

        // Refresh charts if dashboard
        if (sectionId === 'dashboard' && this.data.length > 0) {
            this.updateDashboard();
        }
    }

    async loadSampleData() {
        try {
            const response = await fetch('UM_C19_2021.csv');
            const csvText = await response.text();
            this.parseCSVData(csvText);
            this.updateDashboard();
        } catch (error) {
            console.error('Error loading sample data:', error);
            this.showAlert('Error loading sample data. Please upload a CSV file.', 'danger');
        }
    }

    parseCSVData(csvText) {
        const lines = csvText.trim().split('\n');
        const headers = lines[0].split(',');
        
        this.data = lines.slice(1).map(line => {
            const values = line.split(',');
            return {
                date: new Date(values[0]),
                type: values[1],
                residence: values[2],
                positive: parseInt(values[3]) || 0,
                negative: parseInt(values[4]) || 0
            };
        }).filter(row => row.date && !isNaN(row.date.getTime()));

        console.log(`Loaded ${this.data.length} records`);
    }

    updateDashboard() {
        this.updateMetrics();
        this.createCharts();
    }

    updateMetrics() {
        const totalPositive = this.data.reduce((sum, row) => sum + row.positive, 0);
        const totalNegative = this.data.reduce((sum, row) => sum + row.negative, 0);
        const totalTests = totalPositive + totalNegative;
        const positivityRate = totalTests > 0 ? (totalPositive / totalTests * 100).toFixed(2) : 0;

        // Find peak month
        const monthlyData = this.getMonthlyData();
        const peakMonth = Object.entries(monthlyData)
            .reduce((max, [month, data]) => data.positive > max.positive ? {month, ...data} : max, {month: 'N/A', positive: 0});

        document.getElementById('totalCases').textContent = totalPositive.toLocaleString();
        document.getElementById('totalTests').textContent = totalTests.toLocaleString();
        document.getElementById('positivityRate').textContent = positivityRate + '%';
        document.getElementById('peakMonth').textContent = peakMonth.month;
    }

    getMonthlyData() {
        const monthly = {};
        this.data.forEach(row => {
            const monthKey = row.date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
            if (!monthly[monthKey]) {
                monthly[monthKey] = { positive: 0, negative: 0, total: 0 };
            }
            monthly[monthKey].positive += row.positive;
            monthly[monthKey].negative += row.negative;
            monthly[monthKey].total += row.positive + row.negative;
        });
        return monthly;
    }

    createCharts() {
        this.createDailyCasesChart();
        this.createGroupChart();
        this.createPositivityChart();
        this.createMonthlyChart();
    }

    createDailyCasesChart() {
        const ctx = document.getElementById('dailyCasesChart').getContext('2d');
        
        // Destroy existing chart
        if (this.charts.dailyCases) {
            this.charts.dailyCases.destroy();
        }

        // Group data by date
        const dailyData = {};
        this.data.forEach(row => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { positive: 0, negative: 0 };
            }
            dailyData[dateKey].positive += row.positive;
            dailyData[dateKey].negative += row.negative;
        });

        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
        const positiveData = sortedDates.map(date => dailyData[date].positive);
        const negativeData = sortedDates.map(date => dailyData[date].negative);

        this.charts.dailyCases = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Positive Cases',
                    data: positiveData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Negative Tests',
                    data: negativeData,
                    borderColor: '#198754',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    tension: 0.4,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Number of Tests'
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                }
            }
        });
    }

    createGroupChart() {
        const ctx = document.getElementById('groupChart').getContext('2d');
        
        if (this.charts.group) {
            this.charts.group.destroy();
        }

        const groupData = {};
        this.data.forEach(row => {
            if (!groupData[row.type]) {
                groupData[row.type] = 0;
            }
            groupData[row.type] += row.positive;
        });

        this.charts.group = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: Object.keys(groupData),
                datasets: [{
                    data: Object.values(groupData),
                    backgroundColor: [
                        '#0d6efd',
                        '#198754',
                        '#ffc107',
                        '#dc3545'
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} cases (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    createPositivityChart() {
        const ctx = document.getElementById('positivityChart').getContext('2d');
        
        if (this.charts.positivity) {
            this.charts.positivity.destroy();
        }

        // Calculate daily positivity rates
        const dailyData = {};
        this.data.forEach(row => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { positive: 0, total: 0 };
            }
            dailyData[dateKey].positive += row.positive;
            dailyData[dateKey].total += row.positive + row.negative;
        });

        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
        const positivityData = sortedDates.map(date => {
            const data = dailyData[date];
            return data.total > 0 ? (data.positive / data.total * 100).toFixed(2) : 0;
        });

        this.charts.positivity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Positivity Rate (%)',
                    data: positivityData,
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Date'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Positivity Rate (%)'
                        }
                    }
                }
            }
        });
    }

    createMonthlyChart() {
        const ctx = document.getElementById('monthlyChart').getContext('2d');
        
        if (this.charts.monthly) {
            this.charts.monthly.destroy();
        }

        const monthlyData = this.getMonthlyData();
        const months = Object.keys(monthlyData).sort((a, b) => new Date(a) - new Date(b));
        const positiveData = months.map(month => monthlyData[month].positive);
        const totalData = months.map(month => monthlyData[month].total);

        this.charts.monthly = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [{
                    label: 'Positive Cases',
                    data: positiveData,
                    backgroundColor: '#dc3545',
                    borderColor: '#dc3545',
                    borderWidth: 1
                }, {
                    label: 'Total Tests',
                    data: totalData,
                    backgroundColor: '#0d6efd',
                    borderColor: '#0d6efd',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Month'
                        }
                    },
                    y: {
                        display: true,
                        title: {
                            display: true,
                            text: 'Number of Tests'
                        }
                    }
                }
            }
        });
    }

    handleFileUpload(file) {
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.parseCSVData(e.target.result);
                this.updateDashboard();
                this.showDataPreview();
                this.showAlert('Data uploaded successfully!', 'success');
            } catch (error) {
                console.error('Error parsing CSV:', error);
                this.showAlert('Error parsing CSV file. Please check the format.', 'danger');
            }
        };
        reader.readAsText(file);
    }

    showDataPreview() {
        const preview = document.getElementById('dataPreview');
        const sampleData = this.data.slice(0, 10);
        
        let html = '<table class="table table-striped table-sm">';
        html += '<thead><tr><th>Date</th><th>Type</th><th>Residence</th><th>Positive</th><th>Negative</th></tr></thead>';
        html += '<tbody>';
        
        sampleData.forEach(row => {
            html += `<tr>
                <td>${row.date.toLocaleDateString()}</td>
                <td>${row.type}</td>
                <td>${row.residence}</td>
                <td>${row.positive}</td>
                <td>${row.negative}</td>
            </tr>`;
        });
        
        html += '</tbody></table>';
        html += `<p class="text-muted small">Showing first 10 of ${this.data.length} records</p>`;
        
        preview.innerHTML = html;
    }

    updateAnalysisControls() {
        const analysisType = document.getElementById('analysisType').value;
        const groupFilter = document.getElementById('groupFilter');
        
        // Enable/disable group filter based on analysis type
        if (analysisType === 'group') {
            groupFilter.disabled = false;
        } else {
            groupFilter.disabled = true;
        }
    }

    runAnalysis() {
        const analysisType = document.getElementById('analysisType').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const groupFilter = Array.from(document.getElementById('groupFilter').selectedOptions).map(option => option.value);
        
        // Filter data based on parameters
        let filteredData = this.data;
        
        if (startDate) {
            filteredData = filteredData.filter(row => row.date >= new Date(startDate));
        }
        if (endDate) {
            filteredData = filteredData.filter(row => row.date <= new Date(endDate));
        }
        if (groupFilter.length > 0) {
            filteredData = filteredData.filter(row => groupFilter.includes(row.type));
        }
        
        // Run analysis based on type
        const results = this.performAnalysis(analysisType, filteredData);
        this.displayAnalysisResults(results);
        this.createAnalysisChart(analysisType, filteredData);
    }

    performAnalysis(type, data) {
        switch (type) {
            case 'temporal':
                return this.temporalAnalysis(data);
            case 'group':
                return this.groupAnalysis(data);
            case 'residence':
                return this.residenceAnalysis(data);
            case 'positivity':
                return this.positivityAnalysis(data);
            default:
                return { error: 'Unknown analysis type' };
        }
    }

    temporalAnalysis(data) {
        const dailyData = {};
        data.forEach(row => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { positive: 0, negative: 0, total: 0 };
            }
            dailyData[dateKey].positive += row.positive;
            dailyData[dateKey].negative += row.negative;
            dailyData[dateKey].total += row.positive + row.negative;
        });

        const dates = Object.keys(dailyData).sort();
        const positiveTrend = dates.map(date => dailyData[date].positive);
        const totalTrend = dates.map(date => dailyData[date].total);
        
        const peakDay = dates.reduce((max, date) => 
            dailyData[date].positive > dailyData[max].positive ? date : max, dates[0]);
        
        return {
            type: 'Temporal Analysis',
            totalDays: dates.length,
            peakDay: new Date(peakDay).toLocaleDateString(),
            peakCases: dailyData[peakDay].positive,
            avgDailyCases: (positiveTrend.reduce((a, b) => a + b, 0) / dates.length).toFixed(2),
            avgDailyTests: (totalTrend.reduce((a, b) => a + b, 0) / dates.length).toFixed(2)
        };
    }

    groupAnalysis(data) {
        const groupData = {};
        data.forEach(row => {
            if (!groupData[row.type]) {
                groupData[row.type] = { positive: 0, negative: 0, total: 0 };
            }
            groupData[row.type].positive += row.positive;
            groupData[row.type].negative += row.negative;
            groupData[row.type].total += row.positive + row.negative;
        });

        const results = {};
        Object.keys(groupData).forEach(group => {
            const data = groupData[group];
            results[group] = {
                positive: data.positive,
                total: data.total,
                positivityRate: data.total > 0 ? (data.positive / data.total * 100).toFixed(2) : 0
            };
        });

        return {
            type: 'Group Analysis',
            groups: results
        };
    }

    residenceAnalysis(data) {
        const residenceData = {};
        data.forEach(row => {
            if (!residenceData[row.residence]) {
                residenceData[row.residence] = { positive: 0, negative: 0, total: 0 };
            }
            residenceData[row.residence].positive += row.positive;
            residenceData[row.residence].negative += row.negative;
            residenceData[row.residence].total += row.positive + row.negative;
        });

        const results = {};
        Object.keys(residenceData).forEach(residence => {
            const data = residenceData[residence];
            results[residence] = {
                positive: data.positive,
                total: data.total,
                positivityRate: data.total > 0 ? (data.positive / data.total * 100).toFixed(2) : 0
            };
        });

        return {
            type: 'Residence Analysis',
            residences: results
        };
    }

    positivityAnalysis(data) {
        const dailyData = {};
        data.forEach(row => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { positive: 0, total: 0 };
            }
            dailyData[dateKey].positive += row.positive;
            dailyData[dateKey].total += row.positive + row.negative;
        });

        const positivityRates = Object.values(dailyData)
            .map(data => data.total > 0 ? data.positive / data.total * 100 : 0)
            .filter(rate => rate > 0);

        const avgPositivity = positivityRates.reduce((a, b) => a + b, 0) / positivityRates.length;
        const maxPositivity = Math.max(...positivityRates);
        const highPositivityDays = positivityRates.filter(rate => rate > 10).length;

        return {
            type: 'Positivity Analysis',
            avgPositivity: avgPositivity.toFixed(2),
            maxPositivity: maxPositivity.toFixed(2),
            highPositivityDays: highPositivityDays,
            totalDays: positivityRates.length
        };
    }

    displayAnalysisResults(results) {
        const container = document.getElementById('analysisResults');
        let html = `<h6>${results.type} Results</h6>`;
        
        if (results.error) {
            html += `<div class="alert alert-danger">${results.error}</div>`;
        } else {
            html += '<div class="row">';
            
            Object.keys(results).forEach(key => {
                if (key !== 'type') {
                    if (typeof results[key] === 'object') {
                        html += `<div class="col-md-6 mb-3">
                            <div class="card">
                                <div class="card-body">
                                    <h6 class="card-title">${key.replace(/([A-Z])/g, ' $1').trim()}</h6>`;
                        
                        Object.keys(results[key]).forEach(subKey => {
                            html += `<p class="mb-1"><strong>${subKey.replace(/([A-Z])/g, ' $1').trim()}:</strong> ${results[key][subKey]}</p>`;
                        });
                        
                        html += '</div></div></div>';
                    } else {
                        html += `<div class="col-md-6 mb-2">
                            <p><strong>${key.replace(/([A-Z])/g, ' $1').trim()}:</strong> ${results[key]}</p>
                        </div>`;
                    }
                }
            });
            
            html += '</div>';
        }
        
        container.innerHTML = html;
    }

    createAnalysisChart(type, data) {
        const ctx = document.getElementById('analysisChart').getContext('2d');
        
        if (this.charts.analysis) {
            this.charts.analysis.destroy();
        }

        let chartConfig = {};

        switch (type) {
            case 'temporal':
                chartConfig = this.createTemporalChart(data);
                break;
            case 'group':
                chartConfig = this.createGroupAnalysisChart(data);
                break;
            case 'residence':
                chartConfig = this.createResidenceChart(data);
                break;
            case 'positivity':
                chartConfig = this.createPositivityAnalysisChart(data);
                break;
        }

        this.charts.analysis = new Chart(ctx, chartConfig);
    }

    createTemporalChart(data) {
        const dailyData = {};
        data.forEach(row => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { positive: 0, negative: 0 };
            }
            dailyData[dateKey].positive += row.positive;
            dailyData[dateKey].negative += row.negative;
        });

        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
        const positiveData = sortedDates.map(date => dailyData[date].positive);

        return {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Daily Positive Cases',
                    data: positiveData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Temporal Analysis - Daily Cases'
                    }
                }
            }
        };
    }

    createGroupAnalysisChart(data) {
        const groupData = {};
        data.forEach(row => {
            if (!groupData[row.type]) {
                groupData[row.type] = 0;
            }
            groupData[row.type] += row.positive;
        });

        return {
            type: 'bar',
            data: {
                labels: Object.keys(groupData),
                datasets: [{
                    label: 'Positive Cases',
                    data: Object.values(groupData),
                    backgroundColor: ['#0d6efd', '#198754', '#ffc107', '#dc3545']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Group Analysis - Cases by Type'
                    }
                }
            }
        };
    }

    createResidenceChart(data) {
        const residenceData = {};
        data.forEach(row => {
            if (!residenceData[row.residence]) {
                residenceData[row.residence] = 0;
            }
            residenceData[row.residence] += row.positive;
        });

        return {
            type: 'doughnut',
            data: {
                labels: Object.keys(residenceData),
                datasets: [{
                    data: Object.values(residenceData),
                    backgroundColor: ['#0d6efd', '#198754', '#ffc107']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Residence Analysis - Cases by Residence Type'
                    }
                }
            }
        };
    }

    createPositivityAnalysisChart(data) {
        const dailyData = {};
        data.forEach(row => {
            const dateKey = row.date.toISOString().split('T')[0];
            if (!dailyData[dateKey]) {
                dailyData[dateKey] = { positive: 0, total: 0 };
            }
            dailyData[dateKey].positive += row.positive;
            dailyData[dateKey].total += row.positive + row.negative;
        });

        const sortedDates = Object.keys(dailyData).sort();
        const labels = sortedDates.map(date => new Date(date).toLocaleDateString());
        const positivityData = sortedDates.map(date => {
            const data = dailyData[date];
            return data.total > 0 ? (data.positive / data.total * 100).toFixed(2) : 0;
        });

        return {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Positivity Rate (%)',
                    data: positivityData,
                    borderColor: '#ffc107',
                    backgroundColor: 'rgba(255, 193, 7, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Positivity Analysis - Daily Positivity Rate'
                    }
                }
            }
        };
    }

    showAlert(message, type) {
        const alertDiv = document.createElement('div');
        alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
        alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        `;
        
        document.body.insertBefore(alertDiv, document.body.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (alertDiv.parentNode) {
                alertDiv.parentNode.removeChild(alertDiv);
            }
        }, 5000);
    }
}

// Global functions for HTML onclick handlers
function uploadData() {
    const fileInput = document.getElementById('csvFile');
    if (fileInput.files.length > 0) {
        dashboard.handleFileUpload(fileInput.files[0]);
    } else {
        dashboard.showAlert('Please select a file first.', 'warning');
    }
}

function loadSampleData() {
    dashboard.loadSampleData();
}

function runAnalysis() {
    dashboard.runAnalysis();
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new COVIDDashboard();
});


