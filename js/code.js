"use strict";

/**
 * Copyright (c) 2011 Mikk Kiilaspää (mikk36 at mikk36 eu)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
 */

if(typeof(window.console) === 'undefined') window.console = {log: function (){}};

if (!Date.now)
{
  Date.now = function now()
  {
    return +new Date();
  };
}

var logAnalyzer = {
  chart: null,
  inputData: [],
  graphDataDealt: [],
  graphDataReceived: [],
  statsData: {
    received: [],
    dealt: []
  },
  filesExpected: 0,
  filesRead: 0,
  timesShotTarget: 0,
  timesMissedTarget: 0,
  totalDamageDealt: 0,
  timesShotReceived: 0,
  timesMissedReceived: 0,
  totalDamageReceived: 0,
  firstTimestamp: null,
  lastTimestamp: null,
  initPage: function() {
    if(!this.checkSupport()) {
      $("body").append('<div class="ui-widget" id="not-supported"><div class="ui-state-error ui-corner-all"><p><span class="ui-icon ui-icon-alert"></span><strong>Alert: </strong>Browser not supported.<br><br>Known supported browsers are <span class="no-break">Firefox 4+</span>, <span class="no-break">Chrome 6+</span> and <span class="no-break">Opera 11+</span>.</p></div></div>');
      return;
    }
    $("body").append('<div id="page" class="ui-widget ui-widget-content ui-corner-all"></div>');
    this.initFileInput();
    this.initContents();
    this.initCopyright();
  },
  checkSupport: function() {
    if (window.File && window.FileReader && window.FileList && window.Blob) {
      return true;
    }
    return false;
  },
  initFileInput: function() {
    $("#page").append('<div id="input"></div>');
    $("#input").append('<input type="file" id="filesInput" multiple="">');
    $("#filesInput").bind('change', logAnalyzer.handleInput);
    $("#input").append('<div id="filesDrag">Drop files here</div>');
    $("#filesDrag").bind('dragover', logAnalyzer.handleDragOver);
    $("#filesDrag").bind('drop', logAnalyzer.handleInput);
    $("#input").append('<output id="fileList"></output>');
//    $("#input").append('<button id="hideContents">Show/hide debug</button><pre id="fileContents"></pre>');
//    $("#hideContents").click(function() {
//      $("#fileContents").toggle();
//    });
//    $("#fileContents").hide();
  },
  initContents: function() {
    $("#page").append('<div id="contents"></div>');
    $("#contents").append('<div id="damageGraph"></div><pre id="unidentified"></pre><p id="textGlobal"></p><p id="textDealt"></p><p id="textReceived"></p>');
  },
  handleInput: function(e) {
    var files;
    if(e.target.id == "filesDrag") {
      e.stopPropagation();
      e.preventDefault();
      files = e.originalEvent.dataTransfer.files;
    }
    else {
      files = e.target.files;
    }
    var output = [];
    $("#fileContents, #textGlobal, #textDealt, #textReceived, #unidentified").html('');
    $("#damageGraph").html('').hide();
    logAnalyzer.inputData = [];
    logAnalyzer.logEntries = [];
    logAnalyzer.filesExpected = files.length;
    logAnalyzer.filesRead = 0;
    jQuery.each(files, function(index, file) {
      output.push('<li><strong>', file.name, '</strong> (', file.type || 'n/a', ') - ', file.size, ' bytes</li>');
      var reader = new FileReader();
      reader.onload = function(e) {
        logAnalyzer.filesRead++;
        var lines = e.target.result.match(/^.*([\n\r]+|$)/gm);
        logAnalyzer.parseLines(lines);
        if(logAnalyzer.filesRead == logAnalyzer.filesExpected)
          logAnalyzer.parseLog();
      };
      reader.readAsText(file);
    });
    $("#fileList").html('<ul>'+output.join('')+'</ul>');
  },
  handleDragOver: function(e) {
    e.stopPropagation();
    e.preventDefault();
  },
  initCopyright: function() {
    $("body").append('<div id="copyright" class="ui-widget"><span>CCP Copyright Notice</span><p>EVE Online, the EVE logo, EVE and all associated logos and designs are the intellectual property of CCP hf. All artwork, screenshots, characters, vehicles, storylines, world facts or other recognizable features of the intellectual property relating to these trademarks are likewise the intellectual property of CCP hf. EVE Online and the EVE logo are the registered trademarks of CCP hf. All rights are reserved worldwide. All other trademarks are the property of their respective owners. CCP hf. has granted permission to Mikk Kiilaspää to use EVE Online and all associated logos and designs for promotional and information purposes on its website but does not endorse, and is not in any way affiliated with, Mikk Kiilaspää. CCP is in no way responsible for the content on or functioning of this website, nor can it be liable for any damage arising from the use of this website.</p></div>');
    $("#copyright span").click(function() {
      $("#copyright p").fadeToggle('fast');
    });
  },
  parseLines: function(lines) {
    jQuery.each(lines, function(index, line) {
      if(line[0] != '[')
        return;
      if(line.substr(25, 6) != 'combat')
        return;
      line = line.trim();
      var data = {};

      var text = line.substr(33);

      var missed = true;
      if(text[0] == '<') {
        missed = false;
        text = text.substr(18);
      }

      var received = true;
      if(text.substr(0, 5) == 'Your ') {
        received = false;
      }

      var hitType = null;
      var hitTypeIndex = -1;
      var hitTypes;
      if(!received) {
        hitTypes = ['perfectly strikes', 'places an excellent hit on', 'barely scratches', 'is well aimed at', 'lightly hits', 'hits', 'glances off', 'barely misses', 'misses'];
      } else {
        hitTypes = ['strikes you perfectly', 'places an excellent hit on', 'barely scratches', 'aims well at', 'lightly hits', 'heavily hits', 'hits', 'lands a hit on you which glances off', 'barely misses', 'misses'];
      }
      for(var hitTypeRe in hitTypes) {
        hitTypeIndex = text.search(new RegExp(hitTypes[hitTypeRe], "i"));
        if(hitTypeIndex != -1) {
          hitType = hitTypes[hitTypeRe];
          break;
        }
      }
      var attacker_name = text.substr(0, hitTypeIndex-1);
      if(!received)
        attacker_name = attacker_name.substr(5);
      var attacker_weapon = 'unknown';
      var attacker_weapon_pos = text.search(/belonging to/);
      if(attacker_weapon_pos != -1) {
        attacker_weapon = attacker_name.substr(0, attacker_weapon_pos-1);
        attacker_name = attacker_name.substr(attacker_weapon_pos+13);
      }

      if(hitTypeIndex == -1) {
        $("#unidentified").appendText(line+"\n");
        return;
      }

      var damageSeparatorPos = text.lastIndexOf(",");
      var damagePart = text.slice(damageSeparatorPos + 2, -8);
      var damageAction = damagePart.slice(0, damagePart.lastIndexOf(' '));
      var damageAmount = 0;
      if(!missed)
        damageAmount = damagePart.slice(damagePart.lastIndexOf(' ') + 1);

      var attacked = '';
      if(!received) {
        attacked = text.slice(hitTypeIndex + hitType.length + 1, damageSeparatorPos);
      }
      if(missed && !received)
        if(attacked.slice(-10) == "completely")
          attacked = attacked.slice(0, -11);

      data.date = new Date(line.substr(2, 4), line.substr(7, 2), line.substr(10, 2), line.substr(13, 2), line.substr(16, 2), line.substr(19, 2));
      data.received = received;
      data.missed = missed;
      data.hitType = hitType;
      data.attacker_name = attacker_name;
      data.attacker_weapon = attacker_weapon;
      data.attacked = attacked;
      data.damageAction = damageAction;
      data.damageAmount = parseFloat(damageAmount);
      logAnalyzer.inputData.push(data);
    });
  },
  parseLog: function() {
    logAnalyzer.inputData.sort(function(a, b) {
      return a.date - b.date; //sort by date ascending
    });
    //var outputDebug = '';
    logAnalyzer.timesShotTarget = 0;
    logAnalyzer.timesMissedTarget = 0;
    logAnalyzer.totalDamageDealt = 0;
    logAnalyzer.timesShotReceived = 0;
    logAnalyzer.timesMissedReceived = 0;
    logAnalyzer.totalDamageReceived = 0;
    logAnalyzer.graphDataDealt = [];
    logAnalyzer.graphDataReceived = [];
    logAnalyzer.statsData.dealt = [];
    logAnalyzer.statsData.received = [];
    if(logAnalyzer.inputData.length == 0)
      return;
    logAnalyzer.firstTimestamp = logAnalyzer.inputData[0].date.getTime() / 1000;
    logAnalyzer.lastTimestamp = logAnalyzer.inputData[logAnalyzer.inputData.length - 1].date.getTime() / 1000;
    jQuery.each(logAnalyzer.inputData, function(index, line) {
      //var dateString = line.date.getFullYear() + "." + pad(line.date.getMonth() + 1) + "." + pad(line.date.getDate()) + " " + pad(line.date.getHours()) + ":" + pad(line.date.getMinutes()) + ":" + pad(line.date.getSeconds());
      if(line.received) {
        if(logAnalyzer.statsData.received[line.attacker_name] === undefined)
          logAnalyzer.statsData.received[line.attacker_name] = {name: line.attacker_name,damage: 0, shots: 0, missed: 0};
        logAnalyzer.statsData.received[line.attacker_name].shots++;
        logAnalyzer.statsData.received[line.attacker_name].damage += line.damageAmount;
        if(line.missed)
          logAnalyzer.statsData.received[line.attacker_name].missed++;

        if(logAnalyzer.graphDataReceived[line.date.getTime()/1000] === undefined)
          logAnalyzer.graphDataReceived[line.date.getTime()/1000] = line.damageAmount;
        else
          logAnalyzer.graphDataReceived[line.date.getTime()/1000] += line.damageAmount;

        logAnalyzer.timesShotReceived++;
        if(line.missed) {
          logAnalyzer.timesMissedReceived++;
          //outputDebug += dateString + " " + line.attacker_name + " with " + line.attacker_weapon + " " + line.hitType +" you completely.\n";
        } else {
          logAnalyzer.totalDamageReceived += parseFloat(line.damageAmount);
          //outputDebug += dateString + " " + line.attacker_name + " with " + line.attacker_weapon + " " + line.hitType +" you, " + line.damageAction + " " + line.damageAmount + " damage.\n";
        }
      } else {
        if(logAnalyzer.statsData.dealt[line.attacker_name] === undefined)
          logAnalyzer.statsData.dealt[line.attacker_name] = [];
        if(logAnalyzer.statsData.dealt[line.attacker_name][line.attacked] === undefined)
          logAnalyzer.statsData.dealt[line.attacker_name][line.attacked] = {name: line.attacked, damage: 0, shots: 0, missed: 0};
        logAnalyzer.statsData.dealt[line.attacker_name][line.attacked].shots++;
        logAnalyzer.statsData.dealt[line.attacker_name][line.attacked].damage += line.damageAmount;
        if(line.missed)
          logAnalyzer.statsData.dealt[line.attacker_name][line.attacked].missed++;

        if(logAnalyzer.graphDataDealt[line.date.getTime()/1000] === undefined)
          logAnalyzer.graphDataDealt[line.date.getTime()/1000] = line.damageAmount;
        else
          logAnalyzer.graphDataDealt[line.date.getTime()/1000] += line.damageAmount;

        logAnalyzer.timesShotTarget++;
        if(line.missed) {
          logAnalyzer.timesMissedTarget++;
          //outputDebug += dateString + " Your " + line.attacker_name + " " + line.hitType +" " + line.attacked + " completely.\n";
        } else {
          logAnalyzer.totalDamageDealt += parseFloat(line.damageAmount);
          //outputDebug += dateString + " Your " + line.attacker_name + " " + line.hitType +" " + line.attacked + ", " + line.damageAction + " " + line.damageAmount + " damage.\n";
        }
      }
    });

    this.initGraphs();
    this.initStats();

    $("#textGlobal").append("Hit target " + (logAnalyzer.timesShotTarget - logAnalyzer.timesMissedTarget) + " times<br>");
    $("#textGlobal").append("Missed target " + logAnalyzer.timesMissedTarget + " times<br>");
    $("#textGlobal").append("Hit percentage " + (100 - Math.round(logAnalyzer.timesMissedTarget / logAnalyzer.timesShotTarget * 100)) + "%<br>");
    $("#textGlobal").append("Total damage dealt: " + (Math.round(logAnalyzer.totalDamageDealt*10)/10) + "<br>");
    $("#textGlobal").append("Hit you " + (logAnalyzer.timesShotReceived - logAnalyzer.timesMissedReceived) + " times<br>");
    $("#textGlobal").append("Missed you " + logAnalyzer.timesMissedReceived + " times<br>");
    $("#textGlobal").append("Hit percentage " + (100 - Math.round(logAnalyzer.timesMissedReceived / logAnalyzer.timesShotReceived * 100)) + "%<br>");
    $("#textGlobal").append("Total damage received: " + (Math.round(logAnalyzer.totalDamageReceived*10)/10) + "<br>");
    //$("#fileContents").appendText(outputDebug);
  },
  sortObject: function(arr) {
    // Setup Arrays
    var sortedKeys = new Array();
    var sortedObj = {};

    // Separate keys and sort them
    for (var i in arr){
      sortedKeys.push(i);
    }
    sortedKeys.sort();

    // Reconstruct sorted obj based on keys
    for (var i in sortedKeys){
      sortedObj[sortedKeys[i]] = arr[sortedKeys[i]];
    }
    return sortedObj;
  },
  initStats: function() {
    var textDealt = "", textReceived = "";
    var index, item, target, data;
    for(index in logAnalyzer.statsData.dealt) {
      item = logAnalyzer.statsData.dealt[index];
      item = logAnalyzer.sortObject(item);
      textDealt += "<tr><th colspan=\"6\">" + index + "</th></tr>";
      for(target in item) {
        data = item[target];
        textDealt += "<tr><td>" + target + "</td><td>" + Math.round(data.damage*10)/10 + "</td><td>" + Math.round((data.damage/data.shots)*10)/10 + "</td><td>" + (data.shots - data.missed) + "</td><td>" + data.missed + "</td><td>" + (100 - Math.round((data.missed/data.shots)*100)) + "%</td></tr>";
      }
    }
    logAnalyzer.statsData.received = logAnalyzer.sortObject(logAnalyzer.statsData.received);
    for(index in logAnalyzer.statsData.received) {
      data = logAnalyzer.statsData.received[index];
      textReceived += "<tr><td>" + index + "</td><td>" + Math.round(data.damage*10)/10 + "</td><td>" + Math.round((data.damage/data.shots)*10)/10 + "</td><td>" + (data.shots - data.missed) + "</td><td>" + data.missed + "</td><td>" + (100 - Math.round((data.missed/data.shots)*100)) + "%</td></tr>";
    }
    $("#textDealt").html("<table class=\"damageStats\"><tr><th>Target</th><th>Total damage</th><th>Average damage</th><th>Hits</th><th>Misses</th><th>Hit %</th></tr>" + textDealt + "</table>");
    $("#textReceived").html("<table class=\"damageStats\"><tr><th>Target</th><th>Total damage</th><th>Average damage</th><th>Hits</th><th>Misses</th><th>Hit %</th></tr>" + textReceived + "</table>");
  },
  initGraphs: function() {
    var dataReceived = [], dataDealt = [];
    var maxSteps = 500, minSteps = 10;

    var stepSize = Math.ceil((logAnalyzer.lastTimestamp - logAnalyzer.firstTimestamp) / maxSteps);
    if(stepSize < minSteps)
      stepSize = minSteps;

    var dateOffset = new Date();
    dateOffset = dateOffset.getTimezoneOffset() * 60;

    for(var i = logAnalyzer.firstTimestamp; i <= logAnalyzer.lastTimestamp; i += stepSize) {
      var totalReceived = 0, totalDealt = 0;
      for(var j = i - stepSize; j <= i + stepSize; j++) {
        if(logAnalyzer.graphDataReceived[j] !== undefined) {
          totalReceived += logAnalyzer.graphDataReceived[j];
        }
        if(logAnalyzer.graphDataDealt[j] !== undefined) {
          totalDealt += logAnalyzer.graphDataDealt[j];
        }
      }
      dataReceived.push([(i - dateOffset)*1000, totalReceived/(stepSize * 2 + 1)]);
      dataDealt.push([(i - dateOffset)*1000, totalDealt/(stepSize * 2 + 1)]);
    }

    $("#damageGraph").show();
    logAnalyzer.chart = new Highcharts.Chart({
      chart: {
        renderTo: 'damageGraph',
        type:     'spline',
        zoomType: 'x',
        backgroundColor: 'none'
      },
      title: {
        text: 'DPS Graph'
      },
      xAxis: {
        type: 'datetime'
      },
      yAxis: {
        title: {
          text: 'Damage (DPS)'
        },
        min: 0
      },
      tooltip: {
        formatter: function() {
          return '<strong>' + this.series.name + '</strong><br>' + Highcharts.dateFormat('%H:%M:%S', this.x) + "<br>" + Math.round(this.y*10)/10 + ' DPS';
        }
      },
      series: [{
        name: 'Damage dealt',
        data: dataDealt
      }, {
        name: 'Damage received',
        data: dataReceived
      }]
    });
  }
};

$(document).ready(
  function()
  {
    logAnalyzer.initPage();
  }
);

function pad(n)
{
  return n<10 ? '0'+n : n
}

/*
**  jquery.text.js -- Utilitaires sur l'utilisation de TextNode
**  Copyright (c) 2007 France T�l�com
**  Julien Wajsberg <julien.wajsberg@orange-ftgroupe.com>
**
**  Projet Siclome
**
**  $LastChangedDate$
**  $LastChangedRevision$
*/

(function($) {
  /* jQuery object extension methods */
  $.fn.extend({
  appendText: function(e) {
    if ( typeof e == "string" )
      return this.append( document.createTextNode( e ) );
    return this;
  }
  });
})(jQuery);