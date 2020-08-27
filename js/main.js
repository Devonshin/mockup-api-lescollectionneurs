(function ($, root) {

  $(function () {

    (function () {

      let def = $.Deferred();

      let coffret;
      let coffretCode;
      let establishments;
      let establishmentAllData;

      $.getJSON('./data/coffrets-cadeaux.json', function (d) {
        coffret = d;
      });

      $.get('./data/coffrets-cadeaux-code.json', function (d) {
        coffretCode = d;
      });

      $.get('./data/establishment.json', function (d) {
        establishments = d;
      });

      $.get('./data/establishment-all-by-cate.json', function (d) {
        establishmentAllData = d;
      });

      let idx = setInterval(function () {
        if (coffret && coffretCode && establishments && establishmentAllData) {
          clearInterval(idx);
          def.resolve({
            'establishments': establishments,
            'establishmentAllData': establishmentAllData
          });
        }
      }, 50);

      return def.promise();

    }()).done(function (data) {

      const sections = [
        'equipment',
        'event',
        'eventHall',
        'eventResidential',
        'eventActivity',
        'restaurant',
        'restaurantPrice',
        'restaurantService',
        'roomPrice',
        'roomEquipment',
        'environment',
        'giftboxes',
      ];

      const $establishments = data.establishments;
      const $establishmentCrit = data.establishmentAllData;
      const $idEstablishment = document.getElementById('idEstablishment');
      const $nameEstablishment = document.getElementById('nameEstablishment');
      const $critArea = document.getElementById('search-criteria-area');
      const $fieldArea = document.getElementById('field-area');
      const $urlArea = document.getElementById('interfaceUrl');
      const $jsonViewArea = document.getElementById('jsonPlainView');
      const $jsonTreeArea = $(document.getElementById('jsonTreeView'));
      const $defUrl = 'https://api.lescollectionneurs.com/v1/';

      const findingEstablishments = new EstablishmentData();

      let estbPerPage;

      let pageTab = 'jsonPlainView';
      let jsonText = '';

      $('#responseTab').on('shown.bs.tab', function (e) {

        pageTab = e.target.hash.substr(1);

        if (pageTab === 'jsonTreeView' && !$jsonTreeArea.is('.loaded')) {

          // create json tree object
          const tree = JsonView.createTree(jsonText);

          // render tree into dom element
          JsonView.render(tree, $jsonTreeArea[0]);

          if (tree && tree.el) {
            $(tree.el).children('div.caret-icon').click();
          }
          $jsonTreeArea.addClass('loaded');

        }

      });

      $('#search-criteria-area, #field-area').on('change', 'select', function () {

        if ($.trim($idEstablishment.value) !== '') {
          callApi($idEstablishment);
        } else if ($.trim($nameEstablishment.value) !== '') {
          callApi($nameEstablishment);
        } else {
          callApi();
        }

      });

      let idTimeidx;
      let nameTimeidx;

      $($idEstablishment).on('keyup', function () {

        this.value = this.value.replace(/\D/gi, '');

        clearTimeout(idTimeidx);

        $('#pageNo').val('1');
        $('#pageSize').val('10');
        
        let _t = this;

        idTimeidx = setTimeout(function () {

          $(_t).closest('div.advance-search').find('input#nameEstablishment, select:not([name^=page])').val('');

          if ($.trim(_t.value) !== '') {

            $('#search-criteria-area').find('select:not([name^=page])').attr('disabled', true);
            $($nameEstablishment).attr('disabled', true);

            callApi(_t);

          } else {

            $('#search-criteria-area').find('select:not([name^=page])').attr('disabled', false);
            $($nameEstablishment).attr('disabled', false);

            callApi();

          }
        }, 500);

      });

      $($nameEstablishment).on('keyup', function () {

        $(this).closest('div.advance-search').find('input#idEstablishment').val('');

        clearTimeout(nameTimeidx);

        $('#pageNo').val('1');
        $('#pageSize').val('10');

        let _t = this;

        nameTimeidx = setTimeout(function () {
          if ($.trim(_t.value) !== '') {

            $($idEstablishment).attr('disabled', true);
            callApi(_t);

          } else {

            $($idEstablishment).attr('disabled', false);
            callApi();

          }
        }, 500);

      });

      function convertUrl ($select) {

        let $opts = $select.find('option');
        let $selected = $opts.filter(':selected');
        let $notSelected = $opts.not(':selected');
        let paramName = $select.data('paramName');
        let name = $select.attr('name');
        let target = $select.data('target');

        if ($selected.length) {

          if ($opts.length === $selected.length) {

            if (target === 'establishmentInfo') {

              return paramName + '=^' + $opts[0].value + '$&';

            } else if (name === 'establishmentId') {
              return paramName + '=' + $opts[0].value + '&';
            }

            return paramName + '=ALL&';

          } else if ($opts.length / 2 > $selected.length) {
            return paramName + '=' + $.map($selected, function (select) {
              return select.value
            }).join(',') + '&';
          }

          return paramName + '=' + $.map($notSelected, function (select) {
            return '-' + select.value
          }).join(',') + '&';
        }

        return '';
      }

      function convertUrlField ($select) {

        let $opts = $select.find('option');
        let $selected = $opts.filter(':selected');
        let paramName = $select.data('paramName');

        if ($selected.length) {

          let rss = {};

          $opts.each(function (oix, opt) {

            if (opt.parentNode.tagName === 'OPTGROUP') {
              paramName = opt.parentNode.attributes['data-param-name'].value;
            }

            if (!rss[paramName]) {
              rss[paramName] = {};
              rss[paramName]['selected'] = [];
              rss[paramName]['notselected'] = [];
            }

            rss[paramName][opt.selected ? 'selected' : 'notselected'].push(opt);

          });

          let res = '';
          for (let rk in rss) {

            if (rss.hasOwnProperty(rk)) {

              let opts = rss[rk];
              if (opts['selected'].length) {
                let oLen = opts['selected'].length + opts['notselected'].length;

                if (oLen === opts['selected'].length) {

                  res += rk + '=ALL';

                } else if (oLen / 2 > opts['selected'].length) {

                  res += rk + '=' + $.map(opts['selected'], function (opt) {
                    return opt.value
                  }).join(',') + '&';

                } else {

                  res += rk + '=' + $.map(opts['notselected'], function (opt) {
                    return '-' + opt.value
                  }).join(',') + '&';

                }
              }
            }
          }

          return res;
        }

        return '';
      }

      let minTargetPrice;

      function findEstablishment ($select) {

        let target = $select.data('target');
        let name = $select.attr('name');
        let $opts = $select.find('option');
        let $selected = $opts.filter(':selected');

        let foundEstablishment = {};

        if (target && $selected.length) {

          if ($establishmentCrit[target]) {

            let estaData = JSON.parse(JSON.stringify($establishmentCrit[target]));

            foundEstablishment[target] = [];

            if (target === 'restaurantPrice') {

              if (name === 'minPriceMenu') {
                $selected.each(function (sidx, sv) {
                  minTargetPrice = sv.value;
                });
              }

              estaData.forEach(function (vv) {
                $selected.each(function (sidx, sv) {

                  if (name === 'minPriceMenu' && parseFloat(vv[name]) <= parseFloat(sv.value)) {
                    foundEstablishment[target].push(vv);
                  } else if (name === 'maxPriceMenu' && ((minTargetPrice !== undefined && parseFloat(vv['minPriceMenu']) <= parseFloat(minTargetPrice)) || minTargetPrice === undefined) && parseFloat(vv[name]) <= parseFloat(sv.value)) {
                    foundEstablishment[target].push(vv);
                  }

                });

              });

              if (name === 'maxPriceMenu') {
                minTargetPrice = undefined;
              }

              console.log(foundEstablishment);
            } else {

              estaData.forEach(function (vv) {
                $selected.each(function (sidx, sv) {

                  if (((target === 'establishmentInfo' || name === 'establishmentId') && ('' + vv[name]).toLowerCase().indexOf(('' + sv.value).toLowerCase()) !== -1) || (vv[name] === sv.value)) {
                    if (vv['available'] === undefined || (vv['available'] && vv['available'] === 1)) {
                      foundEstablishment[target].push(vv);
                    }
                  }

                });

              });
            }

          } else {

            alert('Error');
            console.error('error');

          }

          return foundEstablishment;
        }

        return false;
      }

      let uncheckedFields;

      function checkUncheckedField ($select) {

        let target = $select.data('target');
        let name = $select.attr('name');
        let $opts = $select.find('option');
        let $selected = $opts.filter(':selected');
        let $notSelected = $opts.not(':selected');

        if ($selected.length) {

          $opts.each(function (oidx, opt) {

            if (opt.parentNode.tagName === 'OPTGROUP') {
              target = opt.parentNode.attributes['data-target'].value;
            }

            if (!uncheckedFields) {
              uncheckedFields = {};
            }

            if (!uncheckedFields[target]) {
              uncheckedFields[target] = {};
              uncheckedFields[target]['_selected'] = 0;
              uncheckedFields[target]['_notselected'] = 0;
            }

            uncheckedFields[target][opt.selected ? '_selected' : '_notselected']++;
            uncheckedFields[target][opt.value] = !opt.selected;

          });

          for (let unchkdK in uncheckedFields) {
            if (uncheckedFields.hasOwnProperty(unchkdK) && uncheckedFields[unchkdK]['_selected'] === 0) {
              delete uncheckedFields[unchkdK];
            }
          }

          return uncheckedFields;
        }

        return false;

      }

      function callApi (v) {

        $jsonTreeArea.html('');

        let checkEstablishments = checkAll(v);
        $urlArea.innerHTML = $defUrl + checkEstablishments.url + (' <em style="font-size: 12px;">' + byteLength($defUrl + checkEstablishments.url) + ' bytes </em>');

        let key;
        jsonText = JSON.stringify(estbPerPage, function (k, v) {

          if (!uncheckedFields) {
            return v;
          }

          if (k && isNaN(+k) && v && typeof v === 'object') {
            key = k;
          }

          if (typeof v !== 'object') {

            if (key && (uncheckedFields['establishments'] && uncheckedFields['establishments'][k] || uncheckedFields[key] && uncheckedFields[key][k])) {
              return undefined;
            }

          }

          return v;

        }, 2);

        $jsonViewArea.innerHTML = '<pre>' + syntaxHighlight(jsonText) + '</pre>';

        if (pageTab !== 'jsonPlainView') {
          $('#plain-tab').click();
        }

        $jsonTreeArea.removeClass('loaded');
      }

      function findEstablishmentByVal (v) {

        let s = document.createElement('select');

        s.name = v.name
        s.setAttribute('data-target', v.attributes['data-target'].value);
        s.setAttribute('data-param-name', v.attributes['data-param-name'].value);

        let o = document.createElement('option');
        o.value = v.value;
        o.selected = true;

        s.appendChild(o);

        return $(s);
      }

      function checkAll (v) {

        let _tempEsta = JSON.parse(JSON.stringify($establishments));
        let url = 'establishments?';

        findingEstablishments.reset();
        let initFlat = false;
        let foundEsta;
        uncheckedFields = undefined;

        $($fieldArea).find('select').each(function (idx, select) {
          checkUncheckedField($(select));
        });

        let $selects = v ? findEstablishmentByVal(v).add($($critArea).find('select[name^=page]')) : $($critArea).find('select');

        if (v && v.name === 'name') {
          $selects = $selects.add($($critArea).find('select'));
        }

        $selects.each(function (idx, select) {

          let $s = $(select);

          foundEsta = findEstablishment($s);

          url += convertUrl($s);

          if ($s.attr('name') === 'minPriceMenu' && $selects.filter('#maxPriceMenu').find(':selected').length) {
            return;
          }

          for (let fet in foundEsta) {

            if (!foundEsta.hasOwnProperty(fet)) {
              continue;
            }

            initFlat = true;

            if (!foundEsta[fet].length) {
              continue;
            }

            if (findingEstablishments.getCount()) {

              _tempEsta = findingEstablishments.getEstablishments();
              findingEstablishments.reset();

            }

            foundEsta[fet].forEach(function (fe) {

              _tempEsta.forEach(function (est) {

                if (+fe['establishmentId'] === +est['establishmentId']) {

                  if (est[fet]) {

                    if (fet !== 'establishment') {
                      est[fet].push(fe);
                    }

                  } else {

                    if (fet !== 'establishment') {
                      est[fet] = [fe];
                    }

                    findingEstablishments.addEstablishment(est);

                  }

                }

              });

            });

          }

        });

        findingEstablishments.setPageParam($('#pageSize').val(), $('#pageNo').val());

        if (!initFlat) {

          url = 'establishmentss';
          findingEstablishments.addEstablishment(_tempEsta);
          $($fieldArea).find('select').attr('disabled', true);

        } else {

          findingEstablishments.getEstablishments().forEach(function (ee, eidx) {

            sections.forEach(function (vv, ii) {

              if (!ee[vv] && $establishmentCrit[vv] && (!uncheckedFields || uncheckedFields[vv])) {

                $establishmentCrit[vv].forEach(function (ec, ecidx) {

                  if (+ee['establishmentId'] === +ec['establishmentId']) {
                    if (ee[vv]) {
                      ee[vv].push(ec);
                    } else {
                      ee[vv] = [ec];
                    }
                  }

                });
              }

            });

          });

          $($fieldArea).find('select').attr('disabled', false);

        }

        estbPerPage = new EstablishmentData(findingEstablishments);

        $($fieldArea).find('select').each(function (idx, select) {
          let $s = $(select);
          url += convertUrlField($s);
        });

        return {
          url: url.substr(0, url.length - 1)
        };

      }

      //start
      callApi();

      $('div#search-criteria-area button[type=reset]').on('click', function () {

        $(this).closest('div.advance-search').find('input, select:not([name^=page])').val('');

        $('#pageNo').val('1');
        $('#pageSize').val('10');
        $('#search-criteria-area').find('select').attr('disabled', false);
        $($nameEstablishment).attr('disabled', false);

        callApi();

        $($jsonViewArea).animate({scrollTop: 0});

        return false;

      });

      $('div#field-area button[type=reset]').on('click', function () {

        $(this).closest('div.advance-search').find('select').val('');
        callApi();

        return false;

      });

    });

    function EstablishmentData (establishment) {
      this.establishmentCount = (establishment && establishment.getCount()) || 0;
      this.currentPage = (establishment && establishment.getPageNo()) || 1;
      this.pageSize = (establishment && establishment.getPageSize()) || 10;
      this.establishments = (establishment && establishment.getEstablishmentsByPage()) || [];
    }

    EstablishmentData.prototype = {
      reset: function () {
        this.establishments = [];
        this.establishmentCount = 0;
        return this;
      },
      setPageParam: function (l, c) {
        this.currentPage = c || 1;
        this.pageSize = l || 10;
        return this;
      },
      addEstablishment: function (establishment) {

        if (Array.isArray(establishment)) {
          this.establishments = this.establishments.concat(establishment);
        } else {
          this.establishments.push(establishment);
        }

        this.establishmentCount = this.establishments.length;
        return this;
      },
      getEstablishments: function () {
        return this.establishments;
      },
      getEstablishmentsByPage: function () {
        let start = this.currentPage * this.pageSize - this.pageSize;
        let end = this.currentPage * this.pageSize;
        return this.establishments.slice(start, end);
      },
      setData: function (key, data) {
        this[key] = data;
        return this;
      },
      getCount: function () {
        return this.establishmentCount;
      },
      getPageNo: function () {
        return this.currentPage;
      },
      getPageSize: function () {
        return this.pageSize;
      }
    };

  });

  function syntaxHighlight (json) {
    if (typeof json != 'string') {
      json = JSON.stringify(json, undefined, 2);
    }
    json = json.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return json.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g, function (match) {
      let cls = 'number';
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'key';
        } else {
          cls = 'string';
        }
      } else if (/true|false/.test(match)) {
        cls = 'boolean';
      } else if (/null/.test(match)) {
        cls = 'null';
      }
      return '<span class="' + cls + '">' + match + '</span>';
    });
  }

  function byteLength(str) {
    // returns the byte length of an utf8 string
    let s = str.length;
    for (let i=str.length-1; i>=0; i--) {
      let code = str.charCodeAt(i);
      if (code > 0x7f && code <= 0x7ff) s++;
      else if (code > 0x7ff && code <= 0xffff) s+=2;
      if (code >= 0xDC00 && code <= 0xDFFF) i--; //trail surrogate
    }
    return s;
  }
}(jQuery, this));
