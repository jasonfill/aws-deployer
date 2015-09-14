'use strict';

var events = require('events');
var async = require('async');
var fs = require('fs');
var uuid = require('node-uuid');
var util = require('util');
var _ = require('lodash');
var SSH2Shell = require ('ssh2shell');
var osenv = require('osenv');
var aws = require('./aws.js');

var Deployer = function Deployer(config) {

    if (!(this instanceof Deployer)) {
        return new Deployer(config);
    }

    this.config = config;

    if(!config.aws){
        config.aws = {};
    }

    if(!config.aws.region){
        config.aws.region = 'us-east-1';
    }
    if(!config.aws.sslEnabled){
        config.aws.sslEnabled = true;
    }
    if(!config.aws.maxRetries){
        config.aws.maxRetries = 2;
    }
    if(!config.aws.convertResponseTypes){
        config.aws.convertResponseTypes = true;
    }
    if(!config.aws.apiVersion){
        config.aws.apiVersion = '2014-11-11';
    }

    this.aws = aws(config.aws_profile, config.aws);

    if(!config.pem){
        var pem_location = osenv.home() + '/.aws/' + config.aws_profile + '.pem';
        if(fs.existsSync(pem_location)){
            config.pem = fs.readFileSync(pem_location);
        }else{
            throw('PEM was not passed in and does not exist at ' + pem_location);
        }
    }else{
        config.pem = config.pem.replace(/\\n/g,"\n");
    }
};

util.inherits(Deployer, events.EventEmitter);

/**
 * Runs the actual deploy.
 *
 * @async
 * @method run
 * @param {Object}  opts An object of config values.
 * @param {Array}   opts.auto_scaling_groups An array of the auto scaling groups that should be included in the deploy.
 * @param {String}  opts.parallel_groups How the deployment should work with the parallelism.  Possible values include instance_id, launch_config_name, autoscaling_group, availability_zone.  Default is instance_id.
 * @param {Function} callback A function for the callback accepting the following argument 'err, results'.
 * @example
 *    function(err, results){}
 */

Deployer.prototype.run = function (opts, callback){
    var local = {}, _this = this;

    if(!opts.parallel_groups){
        opts.parallel_groups = 'instance_id';
    }

    if(!opts.auto_scaling_groups){
        opts.auto_scaling_groups = config.auto_scaling_groups;
    }

    if(!opts.command){
        _this.emit("error", 'No command to process.');
        return callback('No command to process.');
    }

    local.deployment_id = uuid.v4();

    console.log('============================= START DEPLOY ' + local.deployment_id + '  =================================');

    async.series([
            // get all the data for the auto scaling groups provided...
            function(callback){
                _this.aws.getServerData(opts.auto_scaling_groups, function(err, ASGroups){
                    local.ASGroups = ASGroups;
                    // now regroup per the parameter
                    local.groups_to_process = local.ASGroups.getGroups(opts.parallel_groups);
                    callback();
                });
            },
            // at this point we need to loop the groups and process each in parallel.
            function(callback){
                _this.emit("start-deploy", {deployment_id: local.deployment_id, params: opts, groups: local.groups_to_process, grouping : opts.parallel_groups});
                async.forEachOfSeries(local.groups_to_process, function (group, key, callback) {

                    //console.log('*Starting to deploy group: ' + key + '*');

                    _this.emit("start-deploy-to-group", {
                        deployment_id : local.deployment_id,
                        group_key : key
                    });

                    var ssh = {
                        port: 22,
                        username: 'ubuntu',
                        pem : _this.config.pem
                    };

                    _this.deploy(_.pluck(group, 'instance_id'), local.ASGroups, opts.command, ssh, local.deployment_id, function(){
                        //console.log('*Completed deploy group: ' + key + '*');
                        _this.emit("complete-deploy-to-group", {
                            deployment_id : local.deployment_id,
                            group_key : key
                        });
                        callback();
                    });
                }, function (err) {
                    if (err) console.error(err.message);
                    // configs is now a map of JSON data
                    //doSomethingWith(configs);

                    callback();
                });
            }
        ],
        function(err, results){
            console.log('============================= END DEPLOY '+ local.deployment_id + '  =================================');
            _this.emit("end-deploy", {deployment_id: local.deployment_id});
            callback(null, local.groups_to_process);
        });
};

Deployer.prototype.deploy = function(instance_ids, ASGroups, command, ssh, deployment_id, callback){

    var i, processArr = [], temp, _this = this;

    for(i = 0; i < instance_ids.length; i++){
        processArr.push(_this.makeDeployFunction(instance_ids[i], ASGroups, command, ssh, deployment_id, callback));
    }

    async.parallel(processArr,

        function(err, results){
            //console.log(arguments);
            callback();
        });
};

Deployer.prototype.makeDeployFunction = function (instance_id, ASGroups, command, ssh, deployment_id, callback) {
    var _this = this;
    return function(callback) {
        var instance = ASGroups.getInstance(instance_id);
        _this.deployToInstance(instance_id, instance, command, ssh, deployment_id, function(err, result){
            callback();
        });
    };
};

Deployer.prototype.deployToInstance = function(instance_id, instance, command, ssh, deployment_id, callback){
    var local = {}, _this = this;

    //console.log('---> Start: Deploying to instance: ' + instance_id + ' in ' + instance.availability_zone + ' (' + instance.autoscaling_group + ')' + ' at ' + instance.networking.private_ip);


    _this.emit("start-deploy-to-instance", {instance: instance, deployment_id: deployment_id});

    async.series([
            function(callback){
                var host = {
                    server:              {
                        host:         instance.networking.private_ip,
                        port:         ssh.port,
                        userName:     ssh.username,
                        privateKey:   ssh.pem
                    },
                    commands:      command.split(';'),
                    msg: {
                        send: function( message ) {
                            console.log(message);
                        }
                    },
                    connectedMessage:    "Connected to " + instance.networking.private_ip,
                    readyMessage:        instance.networking.private_ip + " ready for commands",
                    closedMessage:       "Connection to " + instance.networking.private_ip + " closed",
                    onCommandComplete: function( command, response, sshObj ) {
                        _this.emit("command-complete", {response: response, instance: instance, command: command, deployment_id: deployment_id});
                    },
                    onEnd: function( sessionText, sshObj ) {
                        _this.emit("complete-deploy-to-instance", {instance: instance, deployment_id: deployment_id});
                        callback();
                    }
                };
                var SSH       = new SSH2Shell(host);
                SSH.connect();
            }
        ],
        function(err, results){
            return callback(null, local);
        });
};

module.exports = Deployer;