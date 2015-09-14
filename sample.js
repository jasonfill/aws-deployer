
var config = {
    aws_profile: 'smarterservices-deployment'
};

var Deploy = require('./index.js')(config);

var opts = {
    "parallel_groups": "availability_zone",
    "auto_scaling_groups": "SQL-Proxy-ASG",
    "command" : "sudo su;cd /data/application;git reset --hard;git pull;npm install;pm2 reload all;pm2 jlist;"
};

Deploy.run(opts, function (err, ASGroups) {
    console.log(arguments);
});

Deploy.on("start-deploy", function(options){
    console.log(".....Start Deploy---->", options)
});

Deploy.on("start-deploy-to-group", function(key){
    console.log("..........start-deploy-to-group---->", key)
});

Deploy.on("complete-deploy-to-group", function(key){
    console.log("...............complete-deploy-to-group---->", key)
});

Deploy.on("end-deploy", function(options){
    console.log("end-deploy---->", options)
});

Deploy.on("start-deploy-to-instance", function(instance){
    console.log("..............start-deploy-to-instance---->", instance)
});

Deploy.on("command-complete", function(data){

    if(data.command === 'pm2 jlist'){
        var response_parts = data.response.split('\n');
        var json = JSON.parse(response_parts[1]);

        var revision = json[0].pm2_env.versioning.revision

        console.log('..............command-complete---->",', revision);

    }



    //console.log("............command-complete---->", details)
});

Deploy.on("complete-deploy-to-instance", function(instance){
    console.log("-complete-deploy-to-instance---->", instance)
});

Deploy.on("error", function(err){
    console.log("-ERROR---->", err)
});
