/*!
 * Pomelo -- consoleModule watchServer
 * Copyright(c) 2013 fantasyni <fantasyni@163.com>
 * MIT Licensed
 */
var logger = require('pomelo-logger').getLogger(__filename);
var countDownLatch = require('../util/countDownLatch');
var monitor = require('pomelo-monitor');
var utils = require('../util/utils');
var ndump = require('ndump');
var fs = require('fs');

module.exports = function(opts) {
	return new Module(opts);
};

module.exports.moduleId = 'watchServer';

var Module = function(opts) {
	opts = opts || {};
	this.app = opts.app;
};

Module.prototype.monitorHandler = function(agent, msg, cb) {
	var comd = msg['comd'];
	var context = msg['context'];
	var param = msg['param'];
	var app = this.app;

	var handle = 'monitor';

	switch (comd) {
		case 'servers':
			showServers(handle, agent, comd, context, cb);
			break;
		case 'connections':
			showConnections(handle, agent, app, comd, context, cb);
			break;
		case 'logins':
			showLogins(handle, agent, app, comd, context, cb);
			break;
		case 'modules':
			showModules(handle, agent, comd, context, cb);
			break;
		case 'status':
			showStatus(handle, agent, comd, context, cb);
			break;
		case 'config':
			showConfig(handle, agent, app, comd, context, param, cb);
			break;
		case 'proxy':
			showProxy(handle, agent, app, comd, context, param, cb);
			break;
		case 'handler':
			showHandler(handle, agent, app, comd, context, param, cb);
			break;
		case 'cpu':
			dumpCPU(handle, agent, comd, context, param, cb);
			break;
		case 'memory':
			dumpMemory(handle, agent, comd, context, param, cb);
			break;
		default:
			showError(handle, agent, comd, context, cb);
	}
};

Module.prototype.clientHandler = function(agent, msg, cb) {
	var comd = msg['comd'];
	var context = msg['context'];
	var param = msg['param'];
	var app = this.app; // master app

	if (!comd || !context) {
		cb('lack of comd or context param');
		return;
	}

	var handle = 'client';
	switch (comd) {
		case 'servers':
			showServers(handle, agent, comd, context, cb);
			break;
		case 'connections':
			showConnections(handle, agent, app, comd, context, cb);
			break;
		case 'logins':
			showLogins(handle, agent, app, comd, context, cb);
			break;
		case 'modules':
			showModules(handle, agent, comd, context, cb);
			break;
		case 'status':
			showStatus(handle, agent, comd, context, cb);
			break;
		case 'config':
			showConfig(handle, agent, app, comd, context, param, cb);
			break;
		case 'proxy':
			showProxy(handle, agent, app, comd, context, param, cb);
			break;
		case 'handler':
			showHandler(handle, agent, app, comd, context, param, cb);
			break;
		case 'cpu':
			dumpCPU(handle, agent, comd, context, param, cb);
			break;
		case 'memory':
			dumpMemory(handle, agent, comd, context, param, cb);
			break;
		default:
			showError(handle, agent, comd, context, cb);
	}
};

function showServers(handle, agent, comd, context, cb) {
	if (handle === 'client') {
		var sid, record;
		var serverInfo = {};
		var count = utils.size(agent.idMap);
		var latch = countDownLatch.createCountDownLatch(count, function() {
			cb(null, {
				msg: serverInfo
			});
		});

		for (sid in agent.idMap) {
			record = agent.idMap[sid];
			agent.request(record.id, module.exports.moduleId, {
				comd: comd,
				context: context
			}, function(msg) {
				serverInfo[msg.serverId] = msg.body;
				latch.done();
			});
		}
	} else if (handle === 'monitor') {
		var serverId = agent.id;
		var serverType = agent.type;
		var info = agent.info;
		var pid = process.pid;
		var heapUsed = (process.memoryUsage().heapUsed / (1000 * 1000)).toFixed(2);
		var uptime = (process.uptime() / 60).toFixed(2);
		cb({
			serverId: serverId,
			body: {
				serverId: serverId,
				serverType: serverType,
				host: info['host'],
				port: info['port'],
				pid: pid,
				heapUsed: heapUsed,
				uptime: uptime
			}
		});
	}

}

function showConnections(handle, agent, app, comd, context, cb) {
	if (handle === 'client') {
		if (context === 'all') {
			var sid, record;
			var serverInfo = {};
			var count = utils.size(agent.idMap, 'connector');
			var latch = countDownLatch.createCountDownLatch(count, function() {
				cb(null, {
					msg: serverInfo
				});
			});

			for (sid in agent.idMap) {
				record = agent.idMap[sid];
				if (record.type === 'connector') {
					agent.request(record.id, module.exports.moduleId, {
						comd: comd,
						context: context
					}, function(msg) {
						serverInfo[msg.serverId] = msg.body;
						latch.done();
					});
				}
			}
		} else {
			var record = agent.idMap[context];
			if (record.type === 'connector') {
				agent.request(record.id, module.exports.moduleId, {
					comd: comd,
					context: context
				}, function(msg) {
					var serverInfo = {};
					serverInfo[msg.serverId] = msg.body;
					cb(null, {
						msg: serverInfo
					});
				});
			} else {
				cb('\nthis command should be applied to connector server\n');
			}
		}
	} else if (handle === 'monitor') {
		var connection = app.components.__connection__;
		if (!connection) {
			cb({
				serverId: agent.id,
				body: 'error'
			});
			return;
		}

		cb({
			serverId: agent.id,
			body: connection.getStatisticsInfo()
		});
	}
}

function showLogins(handle, agent, app, comd, context, cb) {
	showConnections(handle, agent, app, comd, context, cb);
}

function showModules(handle, agent, comd, context, cb) {
	var modules = agent.consoleService.modules;
	var result = [];
	for (var module in modules) {
		result.push(module);
	}
	cb(null, {
		msg: result
	});
}

function showStatus(handle, agent, comd, context, cb) {
	if (handle === 'client') {
		agent.request(context, module.exports.moduleId, {
			comd: comd,
			context: context
		}, function(err, msg) {
			cb(null, {
				msg: msg
			});
		});
	} else if (handle === 'monitor') {
		var serverId = agent.id;
		var pid = process.pid;
		var params = {
			serverId: serverId,
			pid: pid
		};
		monitor.psmonitor.getPsInfo(params, function(err, data) {
			cb(null, {
				serverId: agent.id,
				body: data
			})
		});
	}
}

function showConfig(handle, agent, app, comd, context, param, cb) {
	if (handle === 'client') {
		if (param === 'master') {
			cb(null, {
				masterConfig: app.get('masterConfig') || 'no config to master in app.js',
				masterInfo: app.get('master')
			});
			return;
		}

		agent.request(context, module.exports.moduleId, {
			comd: comd,
			param: param,
			context: context
		}, function(err, msg) {
			cb(null, msg);
		});
	} else if (handle === 'monitor') {
		var key = param + 'Config';
		cb(null, clone(param, app.get(key)));
	}
}

function showProxy(handle, agent, app, comd, context, param, cb) {
	if (handle === 'client') {
		if (context === 'all') {
			cb('context error');
			return;
		}

		agent.request(context, module.exports.moduleId, {
			comd: comd,
			param: param,
			context: context
		}, function(err, msg) {
			cb(null, msg);
		});
	} else if (handle === 'monitor') {
		proxyCb(app, context, cb);
	}
}

function showHandler(handle, agent, app, comd, context, param, cb) {
	if (handle === 'client') {
		if (context === 'all') {
			cb('context error');
			return;
		}

		agent.request(context, module.exports.moduleId, {
			comd: comd,
			param: param,
			context: context
		}, function(err, msg) {
			cb(null, msg);
		});
	} else if (handle === 'monitor') {
		handlerCb(app, context, cb);
	}
}

function dumpCPU(handle, agent, comd, context, param, cb) {
	if (handle === 'client') {
		agent.request(context, module.exports.moduleId, {
			comd: comd,
			param: param,
			context: context
		}, function(err, msg) {
			cb(err, {
				msg: msg
			});
		});
	} else if (handle === 'monitor') {
		var times = param['times'];
		var filepath = param['filepath'];
		if (!/\.cpuprofile$/.test(filepath)) {
			filepath = filepath + '.cpuprofile';
		}
		if (!times || !/^[0-9]*[1-9][0-9]*$/.test(times)) {
			cb('no times or times invalid error');
			return;
		}
		checkFilePath(filepath, function(err) {
			if (err) {
				cb('filepath invalid error');
				return;
			}
			ndump.cpu(filepath, times);
			cb(null, filepath + ' cpu dump ok')
		});

	}
}

function dumpMemory(handle, agent, comd, context, param, cb) {
	if (handle === 'client') {
		agent.request(context, module.exports.moduleId, {
			comd: comd,
			param: param,
			context: context
		}, function(err, msg) {
			cb(err, {
				msg: msg
			});
		});
	} else if (handle === 'monitor') {
		var filepath = param['filepath'];
		if (!/\.heapsnapshot$/.test(filepath)) {
			filepath = filepath + '.heapsnapshot';
		}
		checkFilePath(filepath, function(err) {
			if (err) {
				cb('filepath invalid error');
				return;
			}
			ndump.heap(filepath);
			cb(null, filepath + ' memory dump ok')
		});

	}
}

function showError(handle, agent, comd, context, cb) {

}

function clone(param, obj) {
	var result = {};
	var flag = 1;
	for (var key in obj) {
		if (typeof obj[key] === 'function' || typeof obj[key] === 'object') {
			continue;
		}
		flag = 0;
		result[key] = obj[key];
	}
	if (flag) {
		return 'no ' + param + 'Config info';
	}
	return result;
}

function checkFilePath(filepath, cb) {
	fs.writeFile(filepath, 'test', function(err) {
		if (err) {
			cb(err);
			return;
		}
		fs.unlinkSync(filepath);
		cb(null);
	})
}

function proxyCb(app, context, cb) {
	var msg = {};
	var __proxy__ = app.components.__proxy__;
	if (__proxy__ && __proxy__.client && __proxy__.client.proxies.user) {
		var proxies = __proxy__.client.proxies.user;
		var server = app.getServerById(context);
		if (!server) {
			cb('no server with this id ' + context);
		} else {
			var type = server['serverType'];
			var tmp = proxies[type];
			msg[type] = {};
			for (var _proxy in tmp) {
				var r = tmp[_proxy];
				msg[type][_proxy] = {};
				for (var _rpc in r) {
					if (typeof r[_rpc] === 'function') {
						msg[type][_proxy][_rpc] = 'function';
					}
				}
			}
			cb(null, msg);
		}
	} else {
		cb('no proxy loaded');
	}
}

function handlerCb(app, context, cb) {
	var msg = {};
	var __server__ = app.components.__server__;
	if (__server__ && __server__.server && __server__.server.handlerService.handlers) {
		var handles = __server__.server.handlerService.handlers;
		var server = app.getServerById(context);
		if (!server) {
			cb('no server with this id ' + context);
		} else {
			var type = server['serverType'];
			var tmp = handles;
			msg[type] = {};
			for (var _p in tmp) {
				var r = tmp[_p];
				msg[type][_p] = {};
				for (var _r in r) {
					if (typeof r[_r] === 'function') {
						msg[type][_p][_r] = 'function';
					}
				}
			}
			cb(null, msg);
		}
	} else {
		cb('no handler loaded');
	}
}