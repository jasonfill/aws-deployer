# AWS Deployer

> **Should be considered very beta at the moment.**

Provides a method to easily deploy/update code from a git repo to all servers within an AWS Autoscaling group.  Similar to how AWS CodeDeploy works without the requirement of the CodeDeploy agent on the actual server.  


## Setup
In order to have things working properly a few different setup items need to be handled.  The primary reason for this is to ensure the AWS resources are properly setup for [secure access](http://blogs.aws.amazon.com/security/post/Tx3D6U6WSFGOK2H/A-New-and-Standardized-Way-to-Manage-Credentials-in-the-AWS-SDKs).

* A directory at ~/.aws.  If you have the aws-cli tools installed this directory should already be created.
* In the ~/.aws directory, a profile file called "credentials" should be created.
* Add a new profile item with your access information.

```
[my-profile]
aws_access_key_id = key
aws_secret_access_key = secret
```

*  Using the profile name from the credentials file, copy the pem to a file in the directory called my-profile.pem.  

## Sample Usage

```
var Deploy = require('aws-deployer')(config);

var opts = {
    "parallel_groups": "availability_zone",
    "auto_scaling_groups": "My-ASG",
    "command" : "sudo su; pwd;"
};

Deploy.run(opts, function (err, groups) {
    console.log(arguments);
});
```

## Config Options

```
{
	aws : 'The standard configuration options for the aws-sdk.  This is not required',
	pem : 'String value of the AWS pem that is required to connect to the servers. This is not required',
	aws_profile : 'name of the profile to use.'
}
```

> NOTE: The AWS IAM User will need to have EC2ReadOnly access.

##Public Functions

### run(opts)
Runs a deployment.

**Parameters:**

* opts (object) - the actual payload of the run.
* opts.parallel_groups (string) - the method the deployment should be grouped.
* opts.auto_scaling_groups (string) - the name of the autoscaling group that the deployment should process on.
* opts.command (string) - the actual commands that should be run for the deployment.

##Events Emitted

Deployer will emit some helpful events:

#### ready

When the instance has been fully setup and ready for use.

```
Deploy.on("ready", function(config){ });
```

#### start-deploy

When the instance has been fully setup and ready for use.

```
Deploy.on("start-deploy", function(config){ });
```

#### start-deploy-to-group

When the deployment has been started for a specific group.

```
Deploy.on("start-deploy-to-group", function(key){ });
```

#### complete-deploy-to-group

When the deployment has been completed for a specific group.

```
Deploy.on("complete-deploy-to-group", function(key){ });
```

#### end-deploy

When the deployment process has fully completed.

```
Deploy.on("end-deploy", function(options){ });
```
#### start-deploy-to-instance

When the instance has been fully setup and ready for use.

```
Deploy.on("start-deploy-to-instance", function(instance){ });
```
#### command-complete

When the instance has been fully setup and ready for use.

* data (object): response, instance, command.

```
Deploy.on("command-complete", function(data){ });
```
#### complete-deploy-to-instance

When the deployment has been completed on a specific instance.

```
Deploy.on("complete-deploy-to-instance", function(instance){ });
```
#### error

If an error is thrown.

```
Deploy.on("error", function(error){ });
```


## Sample Usage

```
var config = {
    aws_profile : 'my-profile'
    };

var Deploy = require('aws-deployer')(config);

var opts = {
    "parallel_groups": "availability_zone",
    "auto_scaling_groups": "My-AutoScaling-Group-Name",
    "command" : "sudo su;cd /data/application;git reset --hard;git pull;npm install;pm2 reload all;pm2 jlist;"
};

Deploy.run(opts, function (err, ASGroups) {
    console.log(arguments);
});

Deploy.on("ready", function(config){
    console.dir("..-->ready---->", config)
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

```


