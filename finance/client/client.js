/*
var log = function(level, args) {
  args = Array.prototype.slice.call(args, 0),
  args.splice(0, 0, level);
  args.splice(0, 0, "winston-client.log");
  args.push(function(error, result) {
    if (error) {
      throw error;
    } else {
      console.log(result);
    }
  });
  Meteor.call.apply(null, args);
}

Winston = {
  log:      function(level) { log(level, arguments)},
  silly:    function() { log('silly', arguments); },
  input:    function() { log('input', arguments); },
  verbose:  function() { log('verbose', arguments); },
  prompt:   function() { log('prompt', arguments); },
  debug:    function() { log('debug', arguments); },
  info:     function() { log('info', arguments); },
  data:     function() { log('data', arguments); },
  help:     function() { log('help', arguments); },
  warn:     function() { log('warn', arguments); },
  error:    function() { log('error', arguments); }
};
*/

var keyMap = { 13: 'enter', 64: '@', 35: '#' };
var deleteFnMap = {
	'transactionsCrud': 'deleteTransactions',
	'tagsCrud': 'deleteTags',
	'accountsCrud': 'deleteAccounts',
	'adminUsersCrud': 'deleteAdminUsers',
	'usersCrud': 'deleteUsers'
};

Session.set('selectedPage', 'user');
Session.set('selectedAccount', null);
Session.set('selectedAdminTab', 'users');
Session.set('selectedPanel', 'transactions');
Session.set('accountToUpdate', null);

/************************************
 * initPage Template
 ************************************/
Template.initPage.isAdmin = function() {
	var userId = Meteor.userId();
	// if there is just one user on the system, that user is the logged in user,
	// so that user should be added as an admin user
	if (Meteor.users.find({}).count() == 1 && AdminUsers.find({}).count() == 0) {
		Meteor.call('addAdminUser', function(error, adminUser) {
			return !error ? true : false;
		});
	} else {
		return isAdmin(userId);
	}
}

/************************************
 * initAdminPage Template
 ************************************/
Template.initAdminPage.pages = function() {
	return [{id: 'user', description: 'Transações'}, {id: 'admin', description: 'Administração'}];
}

Template.initAdminPage.active = function() {
	return Session.equals('selectedPage', this.id) ? 'active' : '';
}

Template.initAdminPage.userPage = function() {
	return Session.equals('selectedPage', 'user');
}

Template.initAdminPage.events({
	'click a.adminPageTab': function(evt, tpl) {
		Session.set('selectedPage', this.id);
	},
	'click a#removeBtn': function(evt, tpl) {
		var tableId = tpl.find('table').id;
		var ids = _.map(tpl.findAll('table td input[type=checkbox]:checked'), function(e) {
			return e.value;
		});
		Meteor.call(deleteFnMap[tableId], ids, function(error) {
			if (error) {
				console.error('Error on delete %s with ids: %s', tableId, ids.join(','), error);
			}
		});
	}
});

/************************************
 * addTransaction Template
 ************************************/
Template.addTransaction.events({
	'click button#addTransactionBtn': function(evt, tpl) {
		insertTransaction(tpl);
	},
	'keypress input#addTransaction': function(evt, tpl) {
		if (keyMap[evt.which] == '@') {
			$('#accountsDropDown').dropdown('toggle');
		} else if (keyMap[evt.which] == '#') {
			$('#tagsDropDown').dropdown('toggle');
		} else if (keyMap[evt.which] == 'enter') {
			insertTransaction(tpl);
		}
	}
});

/************************************
 * accountsDropDown Template
 ************************************/
Template.accountsDropDown.accounts = function() {
	return Accounts.find({userId: Meteor.userId()}, {sort: {name: 1}}).fetch();
}

Template.accountsDropDown.events({
	'click a.accountsDropDownTab': function(evt, tpl) {
		completeDropDown(this.name, '@');
		$('#accountsDropDown').dropdown('toggle');
	}
});

/************************************
 * tagsDropDown Template
 ************************************/
Template.tagsDropDown.tags = function() {
	return Tags.find({userId: Meteor.userId()}, {sort: {name: 1}}).fetch();
}

Template.tagsDropDown.events({
	'click a.tagsDropDownTab': function(evt, tpl) {
		completeDropDown(this.name, '#');
		$('#tagsDropDown').dropdown('toggle');
	}
});

/************************************
 * accountsMenu Template
 ************************************/
Template.accountsMenu.accounts = function() {
	return Accounts.find({userId: Meteor.userId()}, {sort: {order: 1}}).fetch();
}

Template.accountsMenu.active = function() {
	return Session.equals('selectedAccount', this.name) ? 'active' : '';
}

Template.accountsMenu.allAccountsActive = function() {
	return Session.equals('selectedAccount', null) ? 'active' : '';
}

Template.accountsMenu.total = function() {
	var total = {};
	var totalBalance = _.reduce(Accounts.find({userId: Meteor.userId()}).fetch(), function(memo, account) {
		return memo + account.balance;
	}, 0);
	total.color = statusColor(totalBalance);
	total.balance = formatCurrency(totalBalance);
	return total;
}

Template.accountsMenu.formattedBalance = function() {
	return formatCurrency(this.balance);
}

Template.accountsMenu.color = function() {
	return statusColor(this.balance);
}

Template.accountsMenu.events({
	'click a.accountsMenuTab': function(evt, tpl) {
		if (this.name) {
			Session.set('selectedAccount', this.name);
		} else {
			var target = evt.currentTarget || evt.target;
			if (target.href.indexOf('#allAccounts') > -1) {
				Session.set('selectedAccount', null);
			}
		}
	},
	'dblclick a.accountsMenuTab': function(evt, tpl) {
		if (this._id) {
			Session.set('accountToUpdate', this);
			$('#updateAccount').modal('show');
		}
	}
});

/************************************
 * addAccount Template
 ************************************/
Template.addAccount.events({
	'click a#addAccountBtn': function(evt, tpl) {
		var account = {
			name: tpl.find('input#name').value.replace(/\s+/g, ''),
			balance: parseFloat(tpl.find('input#balance').value, 10),
			order: Accounts.find({userId: Meteor.userId()}).count() + 1,
			userId: Meteor.userId()
		};
		if (Accounts.find({userId: Meteor.userId(), name: account.name}).count() > 0) {
			console.error('Account {userId: %s, name: %s} already existed.', Meteor.userId(), account.name);
		} else {		
			Accounts.insert(account, function(err, id) {
				if (!err) {
					console.info('Account %o added', account);
					$(tpl.find('div#addAccount')).modal('hide');
				} else {
					console.error('Error on insert account {name: %s, balance: (+)%d, userId: %s}', account.name, account.balance, Meteor.userId(), err);
				}
			});
		}
	}
});

/************************************
 * updateAccount Template
 ************************************/
Template.updateAccount.account = function() {
	return {
		name: Session.get('accountToUpdate') != null ? Session.get('accountToUpdate').name : '',
		balance: Session.get('accountToUpdate') != null ? Session.get('accountToUpdate').balance.toFixed(2) : '',
		id: Session.get('accountToUpdate') != null ? Session.get('accountToUpdate')._id : '',
	}
}

Template.updateAccount.events({
	'click a#updateAccountBtn': function(evt, tpl) {
		var account = Accounts.findOne({userId: Meteor.userId(), _id: tpl.find('input#id').value});
		if (account == null) {
			console.error('Account %s does not exist.', tpl.find('input#id').value);
		} else {
			if (tpl.find('input#name').value.replace(/\s+/g, '') == '') {
				console.error('Accounts name was not informed');
			} else {
				var name = tpl.find('input#name').value.replace(/\s+/g, '');
				var balance = parseFloat(tpl.find('input#balance').value, 10);			
				Accounts.update({_id: account._id}, {$set: {
					name: name,
					balance: balance
				}}, function(err) {
					if (!err) {
						console.info('Account %s updated with {name: %s, balance: %d}', name, balance);
						$('#updateAccount').modal('hide');
					} else {
						console.error('Error on update account %s', account._id, err);
					}
				});
			}
		}
	}
})

/************************************
 * panes Template
 ************************************/
Template.panes.panes = function() {
	return [{id: 'transactions', name: 'Lançamentos'}, {id: 'tags', name: 'Tags'}];
}

Template.panes.active = function() {
	return Session.equals('selectedPanel', this.id) ? 'active' : '';
}

Template.panes.showTransactionsPanel = function() {
	return Session.equals('selectedPanel', 'transactions');
}

Template.panes.events({
	'click a.panesTab': function(evt, tpl) {
		Session.set('selectedPanel', this.id);
	}
});

/************************************
 * transactionsPane Template
 ************************************/
Template.transactionsPane.transactions = function() {
	var transactions = null;
	if (Session.get('selectedAccount') == null) {
		transactions = Transactions.find({userId: Meteor.userId()}, {sort: {date: -1}}).fetch();
	} else {
		transactions = Transactions.find({userId: Meteor.userId(), account: Session.get('selectedAccount')}, {sort: {date: -1}}).fetch();
	}
	return transactions;
}

Template.transactionsPane.formattedTags = function() {
	return this.tags.join(',');
}

Template.transactionsPane.formattedValue = function() {
	return formatCurrency(this.value);
}

Template.transactionsPane.formattedDate = function() {
	return formatDate(this.date);
}

Template.transactionsPane.color = function() {
	return statusColor(this.value);
}

Template.transactionsPane.events({
	'click a.icon-trash': function(evt, tpl) {
		evt.preventDefault();
		evt.stopPropagation();
		var transaction = this;
		Transactions.remove(transaction._id, function(err) {
			if (err) {
				console.error('Error on remove transaction %s', transaction._id, err);
			} else {
			  var account = Accounts.findOne({name: transaction.account, userId: transaction.userId});
			  Accounts.update(account._id, {$inc: {balance: (transaction.value * -1)}}, function(err) {
			  	if (err) {
			  		console.error('Error on update account %s with balance (-)%d', account._id, transaction.value, err);
			  	} else {
			  		console.info('Account %s updated with balance (-)%d', account._id, transaction.value);
			  	}
			  }); 
			}
		});
	},
	'click #transactions td': function(evt, tpl) {

	}
});

/************************************
 * tags Template
 ************************************/
Template.tagsPanel.tags = function() {
	return Tags.find({userId: Meteor.userId()}, {sort: {name: 1}});
}

Template.tagsPanel.total = function() {
	var total = {};
	var value = _.reduce(Transactions.find({tags: this.name, userId: Meteor.userId()}).fetch(), function(memo, transaction) {
		return memo + transaction.value;
	}, 0);
	total.total = formatCurrency(value);
	total.color = statusColor(value);
	return total;
}

/************************************
 * adminPage Template
 ************************************/
Template.adminPage.entities = function() {
	return [
		{id: 'users', name: 'Usuários'}, 
		{id: 'adminUsers', name: 'Administradores'}, 
		{id:'accounts', name: 'Contas'}, 
		{id:'tags', name: 'Tags'}, 
		{id:'transactions', name: 'Transações'}
	];
}

Template.adminPage.active = function() {
	return Session.equals('selectedAdminTab', this.id) ? 'active' : '';
}

Template.adminPage.showUsers = function() {
	return Session.equals('selectedAdminTab', 'users');
}

Template.adminPage.showAdminUsers = function() {
	return Session.equals('selectedAdminTab', 'adminUsers');
}

Template.adminPage.showAccounts = function() {
	return Session.equals('selectedAdminTab', 'accounts');
}

Template.adminPage.showTags = function() {
	return Session.equals('selectedAdminTab', 'tags');
}

Template.adminPage.showTransactions = function() {
	return Session.equals('selectedAdminTab', 'transactions');
}

Template.adminPage.events({
	'click a.adminPageTab': function(evt, tpl) {
		Session.set('selectedAdminTab', this.id);
	}
});

/************************************
 * usersCrud Template
 ************************************/
Template.usersCrud.users = function() {
	return Meteor.users.find({});
}

Template.usersCrud.events({
	'click th input': function(evt, tpl) {
		toggleCheckBox(tpl);
	}
});

/************************************
* usersCrud Template
************************************/
Template.adminUsersCrud.adminUsers = function() {
	return AdminUsers.find({}).fetch();
}

Template.adminUsersCrud.createdDate = function() {
	return formatDate(this.createdAt, 'DD/MM/YYYY HH:mm:ss');
}

Template.adminUsersCrud.events({
	'click th input': function(evt, tpl) {
		toggleCheckBox(tpl);
	}
});

/************************************
 * accountsCrud Template
 ************************************/
Template.accountsCrud.accounts = function() {
	return Accounts.find({}).fetch();
}

Template.accountsCrud.events({
	'click th input': function(evt, tpl) {
		toggleCheckBox(tpl);
	}
});

/************************************
 * tagsCrud Template
 ************************************/
Template.tagsCrud.tags = function() {
	return Tags.find({}).fetch();
}

Template.tagsCrud.events({
	'click th input': function(evt, tpl) {
		toggleCheckBox(tpl);
	}
});


/************************************
 * transactionsCrud Template
 ************************************/
Template.transactionsCrud.transactions = function() {
	return Transactions.find({}).fetch();
}

Template.transactionsCrud.formattedTags = function() {
	return this.tags.join(',');
}

Template.transactionsCrud.formattedValue = function() {
	return formatCurrency(this.value);
}

Template.transactionsCrud.formattedDate = function() {
	return formatDate(this.date);
}

Template.transactionsCrud.events({
	'click th input': function(evt, tpl) {
		toggleCheckBox(tpl);
	}
});


/************************************
 * Utility functions
 ************************************/
function formatCurrency(value) {
	return 'R$' + value.toFixed(2);
}

function formatDate(date, pattern) {
	var pattern = pattern || 'DD MMM YYYY';
	return moment(date).utc().format(pattern);
}

function statusColor(value) {
	return value > 0 ? 'green' : value < 0 ? 'red' : 'blue';	
}

function completeDropDown(word, symbol) {
	var transValue = $('#addTransaction').val();
	var regex = new RegExp(symbol + '.*');
  $('#addTransaction').val(transValue.replace(regex, symbol + word)).focus();
}

function trim(string) {
  return !string ? string : string.replace(/^\s+|\s+$/g, '');
}

function parseTransaction(tpl) {
  var tInput = tpl.find('input#addTransaction').value.split(' on ');
  var tTokens = trim(tInput[0]).split(' ');
  var tDate = moment().startOf('day');
  var transaction = { account: '', tags: [], value: '', description: '', date: new Date() };
  for (var i = 0; i < tTokens.length; i++) {
    if (tTokens[i].substring(0, 1) == '@') {
      transaction.account = tTokens[i].substring(1);
    } else if (tTokens[i].substring(0, 1) == '#') {
      var tagName = tTokens[i].substring(1);
      if (Tags.find({name: tagName, userId: Meteor.userId()}).count() == 0) {
        var tag = {name: tagName, userId: Meteor.userId()};
        Tags.insert(tag, function(err) {
        	if (err) {
        		console.error('Error on insert tag %o', tag, err);
        	} else {
        		console.info('Tag %o added', tag);
        	}
        });
      }
      transaction.tags.push(tagName);
    } else if (_.isFinite(tTokens[i])) {
      transaction.value = parseFloat(tTokens[i], 10); 
    } else {
      transaction.description += tTokens[i] + ' ';
    }
  }
  if (tInput.length > 1) {
    var tDateString = trim(tInput[1]);
    tDate = moment.utc(tDateString, 'DD MMM YYYY');
    if (!tDate.isValid()) {
      tDate = moment.utc(tDateString, 'DD MMM');
      if (tDate.isValid()) {
        tDate.year(moment().utc().year());
      } else {
        tDate = moment.utc(tDateString, 'DD');
        tDate.month(moment().utc().month()).year(moment().utc().year());
      }
    }
  }
  transaction.date = tDate.utc().toDate();
  transaction.userId = Meteor.userId();
  return transaction;
}

function insertTransaction(template) {
  var transaction = parseTransaction(template);
  try {
  	check(transaction, transactionTemplate);
  } catch (err) {
  	console.error('Error on insert transaction %o', transaction, err);
  }
  Transactions.insert(transaction, function(err) {
  	if (err) {
  		console.error('Error on insert transaction %o', transaction, err);
  	} else {
  		console.info('Transaction %o added', transaction);
		var account = Accounts.findOne({name: transaction.account, userId: transaction.userId});
		Accounts.update(account._id, {$inc: {balance: transaction.value}}, function(err) {
			if (err) {
				console.error('Error on update account %s with {balance: (+)%d}', account._id, transaction.value, err);
			} else {
				console.info('Account %s updated with {balance: (+)%d}', account._id, transaction.value);
			}
		});  		
  	}
  });
}

function toggleCheckBox(tpl) {
	_.each(tpl.findAll('td input'), function(e) {
		e.checked = tpl.find('th input').checked;
	});
}