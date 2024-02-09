google.charts.load('current', {packages: ['corechart', 'line']});
google.charts.setOnLoadCallback(drawBackgroundColor);

function drawBackgroundColor() {
      var data = new google.visualization.DataTable();
      data.addColumn('number', 'X');
      data.addColumn('number', 'Time');

      data.addRows([
        [0, 1], /*1st day is 12/20*/   [1, 0],  [2, 0],  [3, 0],  [4, 3],  [5, 7],
        [6, 0],  [7, 4],  [8, 0],  [9, 0],  [10, 0], [11, 0],
        [12, 0], [13, 2], [14, 0], [15, 0], [16, 1], [17, 0],
        [18, 0], [19, 2], [20, 0], [21, 4], [22, 4], [23, 2],
        [24, 8], [25, 4], [26, 8], [27, 3], [28, 0], [29, 2],
        [30, 3], [31, 10], [32, 14], [33, 15], [34, 3], [35, 7],
        [36, 8], [37, 2], [38, 2], [39, 14], [40, 16], [41, 22],
        [42, 8], [43, 12], [44, 30], [45, 43], [46, 10], [47, 50],
        [48, 16], [49, 2]
      ]);

      var options = {
        hAxis: {
          title: 'Days since 12/20/23'
        },
        vAxis: {
          title: 'Times'
        },
        backgroundColor: '#f1f8e9'
      };

      var chart = new google.visualization.LineChart(document.getElementById('chart_div'));
      chart.draw(data, options);
    }
