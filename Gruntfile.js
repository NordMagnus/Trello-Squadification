module.exports = function(grunt) {

    grunt.loadNpmTasks("grunt-mocha-test");
    grunt.loadNpmTasks("grunt-contrib-compress");

    grunt.initConfig({
        pkg: grunt.file.readJSON("package.json"),
        mochaTest: {
            test: {
                options: {

                },
                src: ['test/**/*.tests.js']
            },
        },
        compress: {
            main: {
                options: {
                    archive: "dist/Trello-Squadification-<%= pkg.version %>.zip",
                },
                files: [
                    {expand: true, cwd: "extension/", src: ["**"], dest: "/"},
                ],
            },
        },
    });

    grunt.registerTask("test", "mochaTest");
    grunt.registerTask("zip", "compress");
    grunt.registerTask("pack", ["test", "zip"]);
};
