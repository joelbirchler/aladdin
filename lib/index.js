//
// Node script that creates the runner.html and kicks off the PhantomJS process
// running (run_jasmine_test.coffee).
//

var spawn = require('child_process').spawn;
var path = require('path');
var fs = require('fs');
var walkdir = require('walkdir');
var Mustache = require('mustache');
var glob = require('glob-whatev').glob;
var istanbul = require('istanbul');

var lib = path.join(__dirname, './../lib');

var render = function(template, context) {
  return Mustache.to_html(template, context);
}

var loadScripts = function(config, f) {
  fs.exists(config, function(exists) {
    if (exists) {
      var sourceFiles = [];

      var scripts = require(path.join(process.cwd(), config));

      scripts.forEach(function(script) {
        var files = glob(path.join(process.cwd(), script));
        sourceFiles = sourceFiles.concat(files);
      });

      f(sourceFiles);
    }
    else {
      f();
    }
  });
}

var loadSpecs = function(dir, f) {
  var specPath = path.join(process.cwd(), dir || 'spec');

  fs.exists(specPath, function(exists) {
    if (!exists) {
      specPath = path.join(process.cwd(), 'spec');
    }

    if (path.extname(specPath) == '.js') {
      f([ specPath ]);
    }
    else {
      var files = walkdir.sync(specPath);
      var specs = files.filter(function(file) {
        return path.extname(file) == '.js';
      });

      f(specs);
    }
  });
}

var writeCoverageReports = function() {
    var collector = new istanbul.Collector();
    collector.add(JSON.parse(fs.readFileSync('client-coverage.json', 'utf8')));

    var consoleReport = istanbul.Report.create('text-summary');
    consoleReport.writeReport(collector, true);

    var htmlReport = istanbul.Report.create('html', {dir: coverageReportPath});
    htmlReport.writeReport(collector, true);
};

var runTests = function(runner) {
  var phantomjs = spawn(
    'phantomjs',
    [path.join(lib, 'run_jasmine_test.coffee'), runner]
  );

  phantomjs.stdout.on('data', function(data) {
    process.stdout.write(data);
  });

  phantomjs.on('close', function(code) {
    if (process.argv.indexOf('--browser') === -1) {
      fs.unlink(runner);
    }

    if (writeCoverage) { writeCoverageReports(); }
    fs.unlink('client-coverage.json');

    process.exit(code);
  });
}

var createRunner = function(html) {
  var runner = path.join(process.cwd(), 'runner.html');

  fs.writeFile(runner, html, function(err, data, error) {
    runTests(runner);
  });
}

var writeCoverage = false,
    coverageReportPath = "./coverage";

module.exports = function(program) {
  var trace = program.trace || false;
  var format = program.format || "none";
  var defer = program.defer || false;

  if (program.cover) {
    writeCoverage = true;
    if (typeof program.cover === "string") { coverageReportPath = program.cover; }
  }

  var template = path.join(lib, 'runner.template.html');

  fs.readFile(template, function(err, data, error) {
    loadScripts(program.config, function(scripts) {
      loadSpecs(program.args.shift(), function(specs) {
        var vendor = path.join(__dirname, './../vendor');

        var context = {
          scripts: scripts,
          specs: specs,
          lib: lib,
          vendor: vendor,
          trace: trace,
          format: format,
          executeJasmine: defer ? "// deferred execution" : "jasmine.getEnv().execute();"
        };

        var html = render(data.toString(), context);

        createRunner(html);
      });
    });
  });
}
