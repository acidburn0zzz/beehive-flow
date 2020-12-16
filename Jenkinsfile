#!groovy
@Library('waluigi@v3.3.0') _

standardProperties()

node("primary") {
  checkout scm

  stage("deps") {
    sh "yarn install"
  }

  stage("stamp") {
    sh "yarn beehive-flow stamp"
  }

  stage("build") {
    sh "yarn build"
  }

  stage("lint") {
    sh "yarn lint"
  }

  stage("test") {
    sh "yarn test"
  }

  stage("publish") {
    sh "yarn beehive-flow publish"
    sh "yarn beehive-flow advance-ci"
  }
}
