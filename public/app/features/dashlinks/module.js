define([
  'angular',
  'lodash',
],
function (angular, _) {
  'use strict';

  var module = angular.module('grafana.directives');

  var iconMap = {
    "external link": "fa-external-link",
    "dashboard": "fa-th-large",
    "question": "fa-question",
    "info": "fa-info",
    "bolt": "fa-bolt",
    "doc": "fa-file-text-o",
    "cloud": "fa-cloud",
  };

  module.directive('dashLinksEditor', function() {
    return {
      scope: {
        dashboard: "="
      },
      restrict: 'E',
      controller: 'DashLinkEditorCtrl',
      templateUrl: 'app/features/dashlinks/editor.html',
      link: function() {
      }
    };
  });

  module.directive('dashLinksContainer', function() {
    return {
      scope: {
        links: "="
      },
      restrict: 'E',
      controller: 'DashLinksContainerCtrl',
      template: '<dash-link ng-repeat="link in generatedLinks" link="link"></dash-link>',
      link: function() { }
    };
  });

  module.directive('dashLink', function($compile, linkSrv) {
    return {
      restrict: 'E',
      link: function(scope, elem) {
        var link = scope.link;
        var template = '<div class="submenu-item dropdown">' +
          '<a class="pointer dash-nav-link" data-placement="bottom"' +
          (link.asDropdown ? ' ng-click="fillDropdown(link)" data-toggle="dropdown"'  : "") + '>' +
          '<i></i> <span></span></a>';

        if (link.asDropdown) {
          template += '<ul class="dropdown-menu" role="menu">' +
            '<li ng-repeat="dash in link.searchHits"><a href="{{dash.url}}"><i class="fa fa-th-large"></i> {{dash.title}}</a></li>' +
            '</ul';
        }

        elem.html(template);
        $compile(elem.contents())(scope);

        var anchor = elem.find('a');
        var icon = elem.find('i');
        var span = elem.find('span');

        function update() {
          var linkInfo = linkSrv.getAnchorInfo(link);
          span.text(linkInfo.title);
          anchor.attr("href", linkInfo.href);
        }

        // tooltip
        elem.find('a').tooltip({ title: scope.link.tooltip, html: true, container: 'body' });
        icon.attr('class', 'fa fa-fw ' + scope.link.icon);
        anchor.attr('target', scope.link.target);

        update();
        scope.$on('refresh', update);
      }
    };
  });

  module.controller("DashLinksContainerCtrl", function($scope, $rootScope, $q, backendSrv, dashboardSrv, linkSrv) {
    var currentDashId = dashboardSrv.getCurrent().id;

    function buildLinks(linkDef) {
      if (linkDef.type === 'dashboards') {
        if (!linkDef.tag) {
          console.log('Dashboard link missing tag');
          return $q.when([]);
        }

        if (linkDef.asDropdown) {
          return $q.when([{
            title: linkDef.title,
            tag: linkDef.tag,
            icon: "fa fa-bars",
            asDropdown: true
          }]);
        }

        return $scope.searchDashboards(linkDef.tag);
      }

      if (linkDef.type === 'link') {
        return $q.when([{
          url: linkDef.url,
          title: linkDef.title,
          icon: iconMap[linkDef.icon],
          tooltip: linkDef.tooltip,
          target: linkDef.targetBlank ? "_blank" : "",
        }]);
      }

      return $q.when([]);
    }

    function updateDashLinks() {
      var promises = _.map($scope.links, buildLinks);

      $q.all(promises).then(function(results) {
        $scope.generatedLinks = _.flatten(results);
      });
    }

    $scope.searchDashboards = function(tag) {
      return backendSrv.search({tag: tag}).then(function(results) {
        return _.reduce(results.dashboards, function(memo, dash) {
          // do not add current dashboard
          if (dash.id !== currentDashId) {
            memo.push({ title: dash.title, url: 'dashboard/db/'+ dash.slug, icon: 'fa fa-th-large', addTime: true });
          }
          return memo;
        }, []);
      });
    };

    $scope.fillDropdown = function(link) {
      $scope.searchDashboards(link.tag).then(function(results) {
        _.each(results, function(hit) {
          hit.url = linkSrv.getLinkUrl(hit);
        });
        link.searchHits = results;
      });
    };

    updateDashLinks();
    $rootScope.onAppEvent('dash-links-updated', updateDashLinks);
  });

  module.controller('DashLinkEditorCtrl', function($scope, $rootScope) {

    $scope.iconMap = iconMap;
    $scope.dashboard.links = $scope.dashboard.links || [];
    $scope.addLink = function() {
      $scope.dashboard.links.push({ type: 'dashboards', icon: 'external link' });
    };

    $scope.moveLink = function(index, dir) {
      _.move($scope.dashboard.links, index, index+dir);
      $scope.updated();
    };

    $scope.updated = function() {
      $rootScope.appEvent('dash-links-updated');
    };

    $scope.deleteLink = function(link) {
      $scope.dashboard.links = _.without($scope.dashboard.links, link);
    };

  });
});