AdminUsers = new Meteor.Collection('adminUsers');
Transactions = new Meteor.Collection('transactions');
Accounts = new Meteor.Collection('accounts');
Tags = new Meteor.Collection('tags');

adminUserTemplate = { userId: String, addedBy: String, createdAt: Date };
accountTemplate = { name: String, balance: Number, order: Number, userId: String };
tagTemplate = { name: String, userId: String };
transactionTemplate = {
	account: String,
	tags: [String],
	value: Number,	
	date: Date,
	description: Match.Optional(String),
	date: Date,
	userId: String
};

AdminUsers.deny({
	// only admin users are allowed to insert another admin user
	insert: function(userId, adminUser) {
		return !isAdmin(userId);
	},
	// only admin users are allowed to remove another admin user
	remove: function(userId, adminUser) {
		return !isAdmin(userId);
	},
	// no one is allowed to update an admin user
	update: function(userId, adminUser, fields, modifier) {
		return true;
	}
});

/**
 * checks if a user is an admin user
 */
isAdmin = function(userId) {
	return AdminUsers.find({'userId': userId}).count() > 0;
};

/**
 * functions that can be invoked over the network by clients
 */
Meteor.methods({
	// add an admin user
	addAdminUser: function(user) {
		var userId = !user ? this.userId : user._userId;
		var adminUser = { userId: userId, addedBy: this.userId, createdAt: moment().utc().toDate()};
		AdminUsers.insert(adminUser, function(err) {
			if (err) {
				console.error('Error on add adminUser %o', adminUser, err);
			} else {
				console.info('AdminUser %o added', adminUser);
			}
		});
	},
	deleteAccounts: function(ids) {
		_.each(ids, function(id) {
			Accounts.remove(id, function(err) {
				var account = Accounts.findOne({_id: id});
				if (err) {
					console.error('Error on remove account %s', id, err);
				} else {
					console.info('Account %s removed', id);
					Transactions.remove({account: account.name, userId: account.userId}, function(err) {
						if (err) {
							console.error('Error on remove transacions from {name: %s, userId: %s}', account.name, account.userId, err);
						} else {
							console.info('Transaction {accout: %s, userId: %s} removed', account.name, account.userId);
						}
					});
				}
			}); 
		});
	},
	deleteUsers: function(ids) {
		_.each(ids, function(id) {
			Users.remove(id, function(err) {
				if (err) {
					console.error('Error on remove user %s', id, err);
				} else {
					console.info('User %s removed', id);
					AdminUsers.remove({userId: id}, function(err) {
						if (err) {
							console.error('Error on remove adminUser {userId: %s}', id, err);
						} else {
							console.info('AdminUser {userId: %s} removed', id);
						}
					});
					Accounts.remove({userId: id}, function(err) {
						if (err) {
							console.error('Error on remove accounts from {userId: %s}', id, err);
						} else {
							console.info('Account {userId: %s} removed', id);
						}
					});
					Tags.remove({userId: id}, function(err) {
						if (err) {
							console.error('Error on remove tags from {userId: %s}', id, err);
						} else {
							console.info('Tag {userId: %s} removed', id);
						}
					});
					Transactions.remove({userId: id}, function(err) {
						if (err) {
							console.error('Error on remove transaction from {userId: %s}', id, err);
						} else {
							console.info('Transactions {userId: %s} removed', id);
						}
					});
				}
			});
		});
	},
	deleteAdminUsers: function(ids) {
		_.each(ids, function(id) {
			AdminUsers.remove(id, function(err) {
				if (err) {
					console.error('Error on remove adminUser %s', id, err);
				} else {
					console.info('AdminUser %s removed', id);
				}
			});
		});
	},
	deleteTags: function(ids) {
		_.each(ids, function(id) {
			var tag = Tags.findOne({_id: id});
			Tags.remove(id, function(err) {
				if (err) {
					console.error('Error on remove tag %s', id, err);
				} else {
					console.info('Tag %s removed', id);
					Transactions.update({tags: tag.name, userId: tag.userId}, {$pull: {tags: tag.name}}, {multi: true}, function(err) {
						if (err) {
							console.error('Error on update transactions from {tags: %s, userId: %s} removing tag %s', tag.name, tag.userId, tag.name, err);
						} else {
							console.info('Tag %s removed from transactions {tags: %s, userId: %s}', tag.name, tag.name, tag.userId);
						}
					});
				}
			});
		});
	},
	deleteTransactions: function(ids) {
		_.each(ids, function(id) {
			var transaction = Transactions.findOne({_id: id});
			Transactions.remove(id, function(err) {
				if (err) {
					console.error('Error on remove transaction %s', id, err);
				} else {
					console.info('Transaction %s removed', id);
					Accounts.update({name: transaction.account, userId: transaction.userId}, {$inc: {balance: (transaction.value * -1)}}, function(err) {
						if (err) {
							console.error('Error on update accounts from {name: %s, userId: %s} adding %d to balance', transaction.account, transaction.userId, (transaction.value * -1), err);
						} else {
							console.info('Update balance (-)%d of account {name: %s, userId: %s}', transaction.value, transaction.account, transaction.userId);
						}
					});
				}
			});
		});
	}
});
