(function () {
  var Soccer = {},
    domain = "soccer.totallysportsinlondon.com";

  Soccer.Collection = Backbone.Collection.extend({
    sync: function (method, model, options) {
      options.timeout = 10000; // required, or the application won't pick up on 404 responses
      options.dataType = "jsonp";
      return Backbone.sync(method, model, options);
    },
    premierLeague: function () {
      return this.filter(function (element) {
        return element.get('league') == 'premier-league';
      });
    },
    championship: function () {
      return this.filter(function (element) {
        return element.get('league') == 'championship';
      });
    }
  });

  Soccer.Model = Backbone.Model.extend({
    from_london: function (teamName) {
      return _.contains(['Arsenal', 'Chelsea', 'Fulham', 'Queens Park Rangers', 'Tottenham Hotspur',
        'Crystal Palace', 'Millwall', 'Watford', 'West Ham United'], teamName);
    },
    from_team: function (teamName) {
      return teamName.toLowerCase() === (this.collection && this.collection.team);
    }
  });

  Soccer.FixturesView = Backbone.View.extend({
    listenForMonthClick: function () {
      var that = this;
      $('.fixtures-month a').click(function () {
        var monthNumber = $(this).data('month');
        that.collection.currentMonth = monthNumber;
        that.collection.fetch();
      });
    },
    selectMonthLink: function () {
      $('.fixtures-month a').removeClass('active');
      $('.fixtures-month a[data-month=' + this.collection.currentMonth + ']').addClass('active');
    }
  });

  $(function () {
    var fixturesContainer = $('.fixtures-container'),
      currentMonth = new Date().getMonth() + 1, fixtures;

    if (fixturesContainer.length > 0) {
      Soccer.Fixture = Soccer.Model.extend({
        dateFormatter: /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/,
        formatKickOffAt: function () {
          var m = this.get('kick_off_at').match(this.dateFormatter);
          return m[3] + '/' + m[2] + '/' + m[1] + ' ' + m[4] + ':' + m[5]
        },
        score: function () {
          var score = '-',
            homeScore = this.get('home_score'),
            awayScore = this.get('away_score'),
            homePenalty = this.get('home_penalty'),
            awayPenalty = this.get('away_penalty');

          if (homeScore !== null && awayScore !== null) {
            score = homeScore + ' - ' + awayScore;
            if (homePenalty !== null && awayPenalty !== null) {
              score += ' (' + homePenalty + ' - ' + awayPenalty + ')'
            }
          }
          return score;
        },
        toJSON: function () {
          var json = Backbone.Model.prototype.toJSON.call(this);
          json.kick_off_at = this.formatKickOffAt();
          json.score = this.score();
          json.home_team_from_london = this.from_london(this.get('home_team'));
          json.away_team_from_london = this.from_london(this.get('away_team'));
          json.home_team_is_current = this.from_team(this.get('home_team'));
          json.away_team_is_current = this.from_team(this.get('away_team'));
          return json;
        }
      });

      Soccer.Fixtures = Soccer.Collection.extend({
        currentMonth: currentMonth,
        model: Soccer.Fixture
      });
      Soccer.AllTeamFixtures = Soccer.Fixtures.extend({
        url: function () {
          return 'http://' + domain + '/fixtures/month/' + this.currentMonth + '?callback=?';
        }
      });
      Soccer.SingleTeamFixtures = Soccer.Fixtures.extend({
        initialize: function (options) {
          this.team = options.team;
        },
        url: function () {
          return 'http://' + domain + '/fixtures/team/' + this.team + '/month/' + this.currentMonth + '?callback=?';
        }
      });

      Soccer.PremierLeagueAndChampionshipView = Soccer.FixturesView.extend({
        initialize: function () {
          this.$elPremierLeague = $(this.options.elPremierLeague);
          this.$elChampionship = $(this.options.elChampionship);
          this.templatePremierLeague = _.template($('#fixtures-template').html());
          this.templateChampionship = _.template($('#fixtures-template').html());

          this.listenForMonthClick();

          _.bindAll(this, 'render', 'selectMonthLink');
          this.collection.bind('reset', this.render);
          this.collection.bind('reset', this.selectMonthLink);
        },
        render: function () {
          this.$elPremierLeague.html(
            this.templatePremierLeague({
              fixtures: (new Backbone.Collection(this.collection.premierLeague())).toJSON()
            })
          );
          this.$elChampionship.html(
            this.templateChampionship({
              fixtures: (new Backbone.Collection(this.collection.championship())).toJSON()
            })
          );
          return this;
        }
      });

      Soccer.SingleTeamView = Soccer.FixturesView.extend({
        initialize: function () {
          this.$el = $(this.el);
          this.template = _.template($('#fixtures-template').html());

          this.listenForMonthClick();

          _.bindAll(this, 'render', 'selectMonthLink');
          this.collection.bind('reset', this.render);
          this.collection.bind('reset', this.selectMonthLink);
        },
        render: function () {
          this.$el.html(
            this.template({
              fixtures: this.collection.toJSON()
            })
          );
          return this;
        }
      });


      if (fixturesContainer.length === 1){
        fixtures = new Soccer.SingleTeamFixtures({
          team: fixturesContainer.data('team')
        });
        new Soccer.SingleTeamView({
          collection: fixtures,
          el: $('#fixtures')
        });
      } else {
        fixtures = new Soccer.AllTeamFixtures();
        new Soccer.PremierLeagueAndChampionshipView({
          collection: fixtures,
          elPremierLeague: $('#fixtures-premier-league'),
          elChampionship: $('#fixtures-championship')
        });
      }
      fixtures.fetch();

      window.Soccer = Soccer;
      window.fixtures = fixtures;
    }
  });

  $(function () {
    var rankingsContainer = $('.rankings-container'), rankings;

    if (rankingsContainer.length > 0) {
      Soccer.Ranking = Soccer.Model.extend({
        toJSON: function () {
          var json = Backbone.Model.prototype.toJSON.call(this);
          json.from_london = this.from_london(this.get('team'));
          json.current_team = this.from_team(this.get('team'));
          return json;
        }
      });

      Soccer.Rankings = Soccer.Collection.extend({
        model: Soccer.Ranking
      });
      Soccer.AllLeagueRankings = Soccer.Rankings.extend({
        url: function () {
          return 'http://' + domain + '/rankings/?callback=?';
        }
      });
      Soccer.SingleLeagueRankings = Soccer.Rankings.extend({
        initialize: function (options) {
          this.team = options && options.team;
          this.league = options && options.league;
        },
        url: function () {
          return 'http://' + domain + '/rankings/league/' + this.league + '/?callback=?';
        }
      });

      Soccer.PremierLeagueAndChampionshipRankingView = Backbone.View.extend({
        initialize: function () {
          var that = this;

          this.$elPremierLeague = $(this.options.elPremierLeague);
          this.$elChampionship = $(this.options.elChampionship);
          this.templatePremierLeague = _.template($('#rankings-template').html());
          this.templateChampionship = _.template($('#rankings-template').html());

          _.bindAll(this, 'render');
          this.collection.bind('reset', this.render);
        },
        render: function () {
          this.$elPremierLeague.html(
            this.templatePremierLeague({
              rankings: (new Backbone.Collection(this.collection.premierLeague())).toJSON()
            })
          );
          this.$elChampionship.html(
            this.templateChampionship({
              rankings: (new Backbone.Collection(this.collection.championship())).toJSON()
            })
          );
          return this;
        }
      });
      Soccer.PremierLeagueRankingView = Backbone.View.extend({
        initialize: function () {
          this.$el = $(this.el);
          this.template = _.template($('#rankings-template').html());

          _.bindAll(this, 'render');
          this.collection.bind('reset', this.render);
        },
        render: function () {
          this.$el.html(
            this.template({
              rankings: this.collection.toJSON()
            })
          );
          return this;
        }
      });

      if (rankingsContainer.length === 1){
        rankings = new Soccer.SingleLeagueRankings({
          team: rankingsContainer.data('team'),
          league: rankingsContainer.data('league')
        });
        new Soccer.PremierLeagueRankingView({
          collection: rankings,
          el: $('#rankings')
        });
      } else {
        rankings = new Soccer.AllLeagueRankings();
        new Soccer.PremierLeagueAndChampionshipRankingView({
          collection: rankings,
          elPremierLeague: $('#rankings-premier-league'),
          elChampionship: $('#rankings-championship')
        });
      }
      rankings.fetch();

      window.rankings = rankings;
    }
  });

})();


