'use strict';

/**
 * Handles all api token related functions
 * @class ApiToken
 * @required async, config, db, AppUtils, utils, redis_client
 */

var events = require('events');
var aws = require('aws-sdk');
var _ = require('lodash');
var util = require('util');
var async = require('async');
var ASGroups = require('./ASGroups');

var AWS = function Aws(config) {

    if (!(this instanceof Aws)) {
        return new Aws(config);
    }

    this.config = config;

    this.autoscaling = new aws.AutoScaling(config);
    this.ec2 = new aws.EC2(config);
    this.elb = new aws.ELB(config);

    this.emit('ready');
};

util.inherits(AWS, events.EventEmitter);

/**
 * Returns all the auto-scaling groups.
 *
 * @async
 * @method getAutoScalingGroups
 * @param {Array} group_names An array of the names of the auto scaling groups to return.  This can be null or omitted to return all auto scaling groups.
 * @param {Function} callback A function for the callback accepting the following argument 'err, groups'.
 * @example
 *    function(err, groups){}
 *
 *    Example groups:
 *
 *    { 'API-ASG':
 *       [ { instance_id: 'i-013face8',
 *     availability_zone: 'us-east-1e',
 *      launch_config_name: 'Webhooks-API-Production',
 *      status: 'HEALTHY',
 *      state: 'InService' } ...
 *      ]}
 */
AWS.prototype.getAutoscalingGroups = function(group_names, callback){
    var params = {};

    // if opts is not provided.
    if (_.isFunction(group_names)) {
        callback = group_names;
        group_names = null;
    }

    this.autoscaling.describeAutoScalingInstances(params, function(err, data) {
        var s,
            groups = new ASGroups();

        if (!err){
            groups.populate(group_names, data);
            callback(null, groups);
        }else{
            callback(err);
        }
    });
};


/**
 * Places all the instances passed in standby mode.
 *
 * @async
 * @method enterStandby
 * @param {Array} instance_ids An array of the instance ids to put in standby.
 * @param {String} group_name The name of the auto scaling group the instances belong to.
 * @param {Function} callback A function for the callback accepting the following argument 'err'.
 * @example
 *    function(err){}
 *
 *    Example groups:
 *
 *    { 'API-ASG':
 *       [ { instance_id: 'i-013face8',
 *     availability_zone: 'us-east-1e',
 *      launch_config_name: 'Webhooks-API-Production',
 *      status: 'HEALTHY',
 *      state: 'InService' } ...
 *      ]}
 */
AWS.prototype.enterStandby = function(instance_ids, group_name, callback){
    var params = {
        AutoScalingGroupName: group_name,
        ShouldDecrementDesiredCapacity: true,
        InstanceIds: instance_ids
    };
    this.autoscaling.enterStandby(params, function(err, data) {
        //console.log(err, data);
        callback(err);
    });
};

/**
 * Suspends all autoscaling so no servers are added.
 *
 * @async
 * @method suspendAutoScaling
 * @param {String} group_name The name of the auto scaling group the instances belong to.
 * @param {Function} callback A function for the callback accepting the following argument 'err'.
 * @example
 *    function(err){}
 *
 */
AWS.prototype.resumeAutoScaling = function(group_name, callback){
    var params = {
        AutoScalingGroupName: group_name,
        ScalingProcesses: ['HealthCheck']
    };

    this.autoscaling.resumeProcesses(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log(data);           // successful response
    });
};

/**
 * Suspends all autoscaling so no servers are added.
 *
 * @async
 * @method suspendAutoScaling
 * @param {String} group_name The name of the auto scaling group the instances belong to.
 * @param {Function} callback A function for the callback accepting the following argument 'err'.
 * @example
 *    function(err){}
 *
 */
AWS.prototype.suspendAutoScaling = function(group_name, callback){
    var params = {
        AutoScalingGroupName: group_name,
        ScalingProcesses: ['HealthCheck']
    };

    this.autoscaling.suspendProcesses(params, function(err, data) {
        if (err) console.log(err, err.stack); // an error occurred
        else     console.log(data);           // successful response
    });
};

/**
 * Places all the instances passed in standby mode.
 *
 * @async
 * @method exitStandby
 * @param {Array} instance_ids An array of the instance ids to put in standby.
 * @param {String} group_name The name of the auto scaling group the instances belong to.
 * @param {Function} callback A function for the callback accepting the following argument 'err'.
 * @example
 *    function(err){}
 *
 *    Example groups:
 *
 *    { 'API-ASG':
 *       [ { instance_id: 'i-013face8',
 *     availability_zone: 'us-east-1e',
 *      launch_config_name: 'Webhooks-API-Production',
 *      status: 'HEALTHY',
 *      state: 'InService' } ...
 *      ]}
 */
AWS.prototype.exitStandby = function(instance_ids, group_name, callback){
    var params = {
        AutoScalingGroupName: group_name,
        InstanceIds: instance_ids
    };

    this.autoscaling.exitStandby(params, function(err, data) {
        //console.log(data);
        callback(err);
    });
};


/**
 * Merges the auto scaling information into each of the instances.
 *
 * @async
 * @method mergeLoadBalancerData
 * @param {Array} group_names An array of the names of the auto scaling groups to return.  This can be null or omitted to return all auto scaling groups.
 * @param {Function} callback A function for the callback accepting the following argument 'err, groups'.
 * @example
 *    function(err, groups){}
 *
 *    Example groups:
 *
 *    { 'API-ASG':
 *       [ { instance_id: 'i-013face8',
 *     availability_zone: 'us-east-1e',
 *      launch_config_name: 'Webhooks-API-Production',
 *      status: 'HEALTHY',
 *      state: 'InService' } ...
 *      ]}
 */
AWS.prototype.mergeLoadBalancerData = function(ASGroups, callback){
    var params = {};
    this.elb.describeLoadBalancers(params, function(err, data) {
        if (!err){
            ASGroups.mergeLBData(data);
            callback(null, ASGroups);
        }else{
            callback(err);
        }
    });
};

/**
 * Merges the actual instance data into each of the instance groups
 *
 * @async
 * @method mergeInstanceData
 * @param {Array} group_names An array of the names of the auto scaling groups to return.  This can be null or omitted to return all auto scaling groups.
 * @param {Function} callback A function for the callback accepting the following argument 'err, groups'.
 * @example
 *    function(err, groups){}
 *
 *    Example groups:
 *
 *    { 'API-ASG':
 *       [ { instance_id: 'i-013face8',
 *     availability_zone: 'us-east-1e',
 *      launch_config_name: 'Webhooks-API-Production',
 *      status: 'HEALTHY',
 *      state: 'InService' } ...
 *      ]}
 */
AWS.prototype.mergeInstanceData = function(ASGroups, callback){
    var params = {
        DryRun: false,
        InstanceIds: ASGroups.getInstanceIds()
    };

    this.ec2.describeInstances(params, function(err, data) {
        if (!err){
            ASGroups.mergeInstanceData(data);
            callback(null, ASGroups);
        }else{
            callback(err);
        }
    });
};

/**
 * Merges the actual instance data into each of the instance groups
 *
 * @async
 * @method mergeInstanceData
 * @param {Array} group_names An array of the names of the auto scaling groups to return.  This can be null or omitted to return all auto scaling groups.
 * @param {Function} callback A function for the callback accepting the following argument 'err, groups'.
 * @example
 *    function(err, groups){}
 *
 *    Example groups:
 *
 *    { 'API-ASG':
 *       [ { instance_id: 'i-013face8',
 *     availability_zone: 'us-east-1e',
 *      launch_config_name: 'Webhooks-API-Production',
 *      status: 'HEALTHY',
 *      state: 'InService' } ...
 *      ]}
 */

AWS.prototype.getServerData = function (auto_scaling_groups, callback){
    var local = {};
    var _this = this;



    // if opts is not provided.
    if (_.isFunction(auto_scaling_groups)) {
        callback = auto_scaling_groups;
        auto_scaling_groups = config.auto_scaling_groups;
    }

    async.series([
            // get all the data in an AS group(s)...
            function(callback){
                _this.getAutoscalingGroups(auto_scaling_groups, function(err, ASGroups){
                    local.ASGroups = ASGroups;
                    callback();
                });
            },
            // merge in the LB data that is needed...
            function(callback){
                _this.mergeLoadBalancerData(local.ASGroups, function(err, ASGroups){
                    local.ASGroups = ASGroups;
                    callback();
                });
            },
            // now go ahead and get the instance data...
            function(callback){
                _this.mergeInstanceData(local.ASGroups, function(err, ASGroups){
                    local.ASGroups = ASGroups;
                    callback();
                });
            }
        ],
        function(err, results){
            callback(null, local.ASGroups);
        });
};


module.exports = AWS;