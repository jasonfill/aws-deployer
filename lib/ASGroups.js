var _ = require('lodash');

var ASGroups = function ASGroups() {
    if (!(this instanceof ASGroups)) {
        return new ASGroups();
    }
    this.instances = [];
};

ASGroups.prototype.populate = function(group_names, aws_as_data){

    // if opts is not provided.
    if (_.isFunction(group_names)) {
        aws_as_data = group_names;
        group_names = null;
    }

    for(s=0; s < aws_as_data.AutoScalingInstances.length; s++){
        var instance = aws_as_data.AutoScalingInstances[s];
        if(!group_names || group_names.indexOf(instance.AutoScalingGroupName) > -1 ){
            if(instance.LifecycleState === 'InService'){
                this.instances.push({
                    instance_id : instance.InstanceId,
                    availability_zone : instance.AvailabilityZone,
                    launch_config_name : instance.LaunchConfigurationName,
                    status: instance.HealthStatus,
                    state: instance.LifecycleState,
                    autoscaling_group: instance.AutoScalingGroupName
                });
            }
        }
    }
};

ASGroups.prototype.mergeLBData = function(aws_lb_data){
    var lbs, lb, i, lb_data={};

    // loop all the load balancers...
    for(lbs=0; lbs < aws_lb_data.LoadBalancerDescriptions.length; lbs++){
        lb = aws_lb_data.LoadBalancerDescriptions[lbs];

        lb_data.name = lb.LoadBalancerName;
        lb_data.dns_name = lb.DNSName;

        //now, loop all the instances...
        for(i = 0; i < lb.Instances.length; i++){
            var instance = this.getInstance(lb.Instances[i].InstanceId);
            if(instance){
                // attach the LB information to the instance now...
                instance.load_balancer = lb_data;
            }
        }
    }
};

ASGroups.prototype.mergeInstanceData = function(aws_instance_data){
    var r, reservation, lb, i;
    // loop all the load balancers...
    for(r=0; r < aws_instance_data.Reservations.length; r++){
        reservation = aws_instance_data.Reservations[r];

        //now, loop all the instances...
        for(i = 0; i < reservation.Instances.length; i++){
            var instance_data = {};
            //console.log(reservation.Instances[i]);
            var instance = this.getInstance(reservation.Instances[i].InstanceId);
            if(instance){
                instance_data.private_dns = reservation.Instances[i].PrivateDnsName;
                instance_data.public_dns = reservation.Instances[i].PublicDnsName;
                instance_data.private_ip = reservation.Instances[i].PrivateIpAddress;
                instance_data.public_ip = reservation.Instances[i].PublicIpAddress;
                instance_data.subnet = reservation.Instances[i].SubnetId;

                // attach the LB information to the instance now...
                instance.networking = instance_data;
            }
        }
    }
};

ASGroups.prototype.getInstance = function(instance_id){
    var i;

        // loop the instances now...
        for(i=0; i < this.instances.length; i++){
            if(this.instances[i].instance_id === instance_id){
                return this.instances[i];
            }
        }
};

ASGroups.prototype.getInstanceIds = function(){
    var i, instances = [];

    // loop the instances in the group now...
    for(i=0; i < this.instances.length; i++){
        instances.push(this.instances[i].instance_id);
    }
    return instances;
};

ASGroups.prototype.getGroups = function(group_by){

    if(!group_by){
        group_by = 'autoscaling_group';
    }

    return _.groupBy(this.instances, function(n) {
        return n[group_by];
    });
};

ASGroups.prototype.getGroup = function(group_name, group_by){

    if(!group_by){
        group_by = 'autoscaling_group';
    }

    var groups = this.getGroups(group_by);
    return groups[group_name];
};

ASGroups.prototype.groupCount = function(group_by){

    if(!group_by){
        group_by = 'autoscaling_group';
    }

    var groups = this.getGroups(group_by);

    return Object.keys(groups).length;
};

module.exports = ASGroups;