/*eslint-disable */



module.exports = function(grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        browserify: {
            options: {
                separator: ';',
                browserifyOptions: {
                     debug: true
                }
            },
            patch: {
                files: {
                    'layer-patch-build.js': ['index.js']
                }
            }
        },
        watch: {
            patch: {
                files: ['layer-patch.js', 'index.js'],
                tasks: ["browserify"]
            }
        }

    });


    grunt.loadNpmTasks('grunt-browserify');
    grunt.loadNpmTasks('grunt-contrib-watch');

};