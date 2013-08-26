var apiKey;

if (!window.console)
	window.console = { error: function(){}, log: function(){}, warn: function(){} };

ko.bindingHandlers.toggle = {
	init: function (e, v) {
		e = $(e); v = v(), toggle = ko.utils.unwrapObservable(typeof v === "object" ? v.value : v);
		toggle ? e.show() : e.hide();
	},
	update: function (e, v) {
		e = $(e); v = v();
		var toggle = typeof v === "object" ? ko.utils.unwrapObservable(v.value) : ko.utils.unwrapObservable(v);
		if (v.effect) {
			switch (v.effect) {
				case "slide":
					toggle ? e.slideDown() : e.slideUp();
					break;
				case "slideHorizontal", "slideH":
					toggle ? e.show("slide", { direction: "right" }) : e.hide("slide", { direction: "left" });
					break;
				case "fade":
					toggle ? e.fadeIn() : e.fadeOut();
					break;
				default:
					toggle ? e.show() : e.hide();
					break;
			}
		}
		else toggle ? e.show() : e.hide();
	}
};

var isMobileDevice = /iPhone|iPad|iPod/i.test(navigator.userAgent);
ko.bindingHandlers.idevicify = {
	init: function(e, v) {
		v = v();
		
		if (!isMobileDevice || typeof v !== "object")
			return;
			
		for (var key in v)
			e.setAttribute(key, v[key]);
	}
};

var StatusModel = function(data) {
	var self = this;
	
	var type = data.type;
	var date = data.date;
	var text = data.text;
	
	var cssType = function() {
		return (type == "ERROR" ? "error" : type == "WARNING" ? "warning" : "info");
	};
	
	// public
	self.type = type;
	self.date = date;
	self.text = text;
	self.cssType = cssType;
};

var StatusListModel = function() {
	var self = this;
	
	// properties
	var items = ko.observableArray();
	var isFirstLoad = ko.observable(true);
	
	// computed
	var isEmpty = ko.computed(function() {
		return items().length <= 0;
	}, self);
	
	// functions
	var clear = function() {
		if (!confirm("Are you sure you want to clear all status messages?"))
			return;
			
		$.when($.ajax({
			url: "status/clearwarnings", 
			type: "GET", 
			cache: false, 
			data: { session: apiKey }
		}))
		.then(function(r) {
			items.removeAll();
		})
		.fail(function(e) {
			console.error("Error clearing warnings", e);
		});
	};

	var refresh = function() {
		$.when($.ajax({ 
			url: "tapi", 
			type: "GET", 
			cache: false, 
			data: { 
				mode: "warnings", 
				output: "json", 
				apikey: apiKey 
			}
		}))
		.then(function(r){
			if (!r)
				return;
		
			$.each(r.warnings, function() {
				var splits = this.toString().split(/\n/);
				var data = { type: splits[1], date: splits[0], text: splits[2] };
			
				var existingItem = ko.utils.arrayFirst(self.items(), function(i) { return i.date == data.date; });
			
				if (!existingItem) {
					items.splice(0, 0, new StatusModel(data));
					console.log("Added new status", data);
				}
			});
			
			if (isFirstLoad())	
				isFirstLoad(false);
		})
		.fail(function(e){
			console.error("Error loading warnings", e);
		});
	};

	var showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
	var hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }
	
	// public properties
	self.items = items;
	self.isFirstLoad = isFirstLoad;
	self.isEmpty = isEmpty;
	
	// public methods
	self.clear = clear;
	self.refresh = refresh;
	self.hideItem = hideItem;
	self.showItem = showItem;
};

var QueueModel = function(data) {
	var self = this;
	
	// properties
	var id;
	var index = ko.observable();
	var name = ko.observable();
	var status = ko.observable();
	var totalMB = ko.observable();
	var remainingMB = ko.observable();
	var showMore = ko.observable(false);
  var editingName = ko.observable(false);
  var editedName = ko.observable();
		
	// computed
	var categoryInternal = ko.observable();
	var category = ko.computed({
		read: function() { return categoryInternal(); },
		write: function(v) { if (!v) v = "Default"; if (v != categoryInternal()) { changeCategory(v); categoryInternal(v); } }
	}, self);
	
	var scriptInternal = ko.observable();
	var script = ko.computed({
		read: function() { return scriptInternal(); },
		write: function(v) { if (!v) v = "Default"; if (v != scriptInternal()) { changeScript(v); scriptInternal(v); } }
	}, self);
	
	var optionInternal = ko.observable();
	var option = ko.computed({
		read: function() { return optionInternal(); },
		write: function(v) { if (!v) v = 0; if (v != optionInternal()) { changeOption(v); optionInternal(v); } }
	}, self);
	
	var priorityInternal = ko.observable();
	var priority = ko.computed({
		read: function() { return priorityInternal(); },
		write: function(v) { if (!v) v = 0; if (v != priorityInternal()) { changePriority(v); priorityInternal(v); } }
	}, self);
	
	var downloadedMB = ko.computed(function() {
		return (totalMB() - remainingMB()).toFixed(2);
	}, self);
	
	var percentage = ko.computed(function() {
		return ((downloadedMB() / totalMB()) * 100).toFixed(2);
	}, self);
	
	var percentageRounded = ko.computed(function() {
		return Math.floor(percentage() || 0);
	}, self);
	
	var isPaused = ko.computed(function() {
		return status() == "Paused";
	}, self);
	
	var isDownloading = ko.computed(function() {
		return status() == "Downloading";
	}, self);
	
	var hasData = ko.computed(function() {
		return downloadedMB() > 0;
	}, self);
	
	var showProgressBar = ko.computed(function() {
		return isDownloading() || hasData();
	}, self);
	
	// subscriptions
  editedName.subscribe(function(v) { if (v != name()) changeName(v); });
	
	// functions
	var toggleMore = function() {
		showMore(!showMore());
	};
	
	var editName = function() {
	  var currentState = editingName();
	  
	  if (currentState) {
	    if (editedName() != name())
	      changeName(editedName());
	  }
	  else
	    editedName(name());
	    
	  editingName(!currentState);
	};
	
	var changeName = function(value) {
	  console.log("Changing queue name", this, value);
	  var previousName = name();
	  name(value);
	  
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "rename", value: id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (!r.status)
				name(previousName);
		})
		.fail(function(e) {
			console.error("Error changing queue category", e);
			name(previousName);
		});
	};
	
	var changeCategory = function(value) {
		console.log("Changing queue category", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_cat", value: id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				categoryInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue category", e);
		});
	};
	
	var changeOption = function(value) {
		console.log("Changing queue option", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_opts", value: id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				optionInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue option", this, e);
		});
	};
	
	var changePriority = function(value) {
		console.log("Changing queue priority", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "priority", value: id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				priorityInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue priority", this, e);
		});
	};
	
	var changeScript = function(value) {
		console.log("Changing queue script", this, value);
    
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "change_script", value: id, value2: value, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				scriptInternal(value);
		})
		.fail(function(e) {
			console.error("Error changing queue script", e);
		});
	};
	
	var toggleState = function() {
		console.log("Changing queue state", this);
		
		var actionType = isPaused() ? "resume" : "pause";
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: actionType, value: id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true)
				status(isPaused() ? "Downloading" : "Paused");
		})
		.fail(function(e) {
			console.error("Error toggling queue state", this, e);
		});
	};
    
	var updateFromData = function(data) {
		id = data.nzo_id;
		index(data.index);
		if (!editingName())
		  name($.trim(data.filename));
		status(data.status);
		categoryInternal(/^\*|None$/.test(data.cat) ? "Default" : data.cat);
		priorityInternal(data.priority || "2");
		scriptInternal(data.script);
		optionInternal(parseInt(data.unpackopts));
		totalMB(parseFloat(data.mb));
		remainingMB(parseFloat(data.mbleft));
	};
	
	// initialize from data
	updateFromData(data);
	
	
	// public properties
	self.id = id;
	self.index = index;
	self.name = name;
	self.status = status;
	self.totalMB = totalMB;
	self.remainingMB = remainingMB;
	self.showMore = showMore;
	self.category = category;
	self.script = script;
	self.option = option;
	self.priority = priority;
	self.downloadedMB = downloadedMB;
	self.percentage = percentage;
	self.percentageRounded = percentageRounded;
	self.isPaused = isPaused;
	self.isDownloading = isDownloading;
	self.hasData = hasData;
	self.showProgressBar = showProgressBar;
	self.editingName = editingName;
	self.editedName = editedName;
	
	// public methods
	self.toggleState = toggleState;
	self.toggleMore = toggleMore;
	self.changeCategory = changeCategory;
	self.changeOption = changeOption;
	self.changePriority = changePriority;
	self.changeScript = changeScript;
	self.updateFromData = updateFromData;
	self.editName = editName;
};

var QueueListModel = function() {
	var self = this;
	
	// constants
	var refreshXhr;
	var defaultItemsPerPage = 20;
	var speed = ko.observable(0);
	var speedMetric = ko.observable();
	var updater = new SABUpdaterModel();
	
	var priorities = []; 
		priorities["Force"] = 2; 
		priorities["High"] = 1; 
		priorities["Normal"] = 0; 
		priorities["Low"] = -1; 
		priorities["Stop"] = -4;
		
	var speedMetrics = []
		speedMetrics["K"] = "KB/s";
		speedMetrics["M"] = "MB/s";
		speedMetrics["G"] = "GB/s"; // hope to see this one day...
	
	var scripts = ko.observableArray([]);
	var categories = ko.observableArray([]);
	var priorities = ko.observableArray([
		{ value: 2, name: "Force" },
		{ value: 1, name: "High" },
		{ value: 0, name: "Normal" },
		{ value: -1, name: "Low" },
		{ value: -4, name: "Stop" }
	]);
	var options = ko.observableArray([
		{ value: 0, name: "Download" },
		{ value: 1, name: "+Repair" },
		{ value: 2, name: "+Unpack" },
		{ value: 3, name: "+Delete" }
	]);

	var itemsTotal = ko.observable(0);
	var items = ko.observableArray();
	var currentPage = ko.observable(0);
	var pages = ko.observableArray([]);
	var isPaused = ko.observable(false);
	var timeRemaining = ko.observable();
	var speedLimit = ko.observable("");
	var isFirstLoad = ko.observable(true);
	var itemsPerPageInt = ko.observable();
	var itemsPerPage = ko.computed({
		read: function() { 
			itemsPerPageInt(parseInt(localStorage.queueItemsPerPage || defaultItemsPerPage)); 
			return itemsPerPageInt(); 
		},
		write: function(v) { 
			if (!v || isNaN(v) || parseInt(v) <= 0)
				v = defaultItemsPerPage;
			localStorage.queueItemsPerPage = v; 
			itemsPerPageInt(v); 
		}
	}, self);
	
	itemsPerPage.subscribe(function(v) {
		refresh({ force: true });
	});
	
	// computables
	var hasSpeedLimit = ko.computed(function() {
		return speedLimit() && !isNaN(speedLimit());
	}, self);
	
	var hasScripts = ko.computed(function() {
		return scripts().length > 0;
	}, self);
	
	var isEmpty = ko.computed(function() {
		return items().length <= 0;
	}, self);
	
	var hasMultiplePages = ko.computed(function() {
		return itemsTotal() / itemsPerPage() > 1;
	}, self);
	
	var showDownloadSpeed = ko.computed(function() {
		return !isPaused() && !isEmpty() && speed() > 0;
	}, self);
	
	var downloadSpeed = ko.computed(function() {
		if (showDownloadSpeed())
			return speed() + ' ' + speedMetrics[speedMetric()];
	}, self);
	
	// subscriptions
	speedLimit.subscribe(function(v) {
		if (!v || isNaN(v) || parseInt(v) < 0)
			speedLimit("");
			
		setSpeedLimit(parseInt(v));
	});
	
	itemsTotal.subscribe(function(v) {
		SetPages();
	}, self);
	
	currentPage.subscribe(function(v) {
		SetPages();
	}, self);
	
	var moveItem = function(e) {
		var itemMoved = e.item;
		var itemReplaced = ko.utils.arrayFirst(items(), function(i) { return i.index() == e.targetIndex; });
		
		itemMoved.index(e.targetIndex);
		itemReplaced.index(e.sourceIndex);
		
		console.log("Moving queue", e, itemMoved);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "switch", value: itemMoved.id, value2: e.targetIndex, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.position != e.targetIndex) {
				itemMoved.index(e.sourceIndex);
				itemReplaced.index(e.targetIndex);
			}
		})
		.fail(function(e) {
			console.error("Error moving queue", itemMoved, e);
      itemMoved.index(e.sourceIndex);
      itemReplaced.index(e.targetIndex);
		});
	};
	
	var removeItem = function() {
		if (!confirm("Are you sure you want to delete this?"))
			return;
		
		var itemToDelete = this;
		
		console.log("Removing queue item", itemToDelete);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "queue", name: "delete", value: this.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true) {
				items.remove(itemToDelete);
				refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error deleting queue item", itemToDelete, e);
		});
	};
	
	var toggleQueueState = function() {
		console.log("Changing queue state");
		
		var targetState = !isPaused();
		isPaused(targetState);
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: !targetState ? "resume" : "pause", output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (!r.status)
				isPaused(!targetState);
		})
		.fail(function(e) {
			isPaused(!targetState);
			console.error("Error changing queue state", this, e);
		});
	};
	
	var refresh = function(opts) {
		var force = opts && opts.force == true || false;
		
		if (!force && refreshXhr && refreshXhr.readyState != 4)
			return;
		
		if (refreshXhr && refreshXhr.readyState != 4)
			refreshXhr.abort();
			
		refreshXhr = $.ajax({ 
			url: "tapi", 
			type: "GET", 
			cache: false, 
			data: { 
				mode: "queue", 
				start: currentPage() * itemsPerPage(), 
				limit: itemsPerPage(), 
				output: "json", 
				apikey: apiKey
			} 
		});
		
		$.when(refreshXhr)
		.then(function(r){
			if (!r)
				return;
				
			var currentItemIds = $.map(items(), function(i) { return i.id; });
		
			if (r.queue.noofslots != itemsTotal())
				itemsTotal(r.queue.noofslots);
				
			var queueSpeed = r.queue.speed.split(/\s/);
			if (queueSpeed.length == 2) {
				speed(parseFloat(queueSpeed[0]));
				speedMetric(queueSpeed[1]);
			}
			timeRemaining(r.queue.timeleft);
			
			if (r.queue.scripts.length != scripts().length)
				scripts($.map(r.queue.scripts, function(i) { return i == "*" ? "None" : i }));
			
			if (r.queue.categories.length != categories().length)
				categories($.map(r.queue.categories, function(i) { return i == "*" || i == "None" ? "Default" : i }));
			
			isPaused(r.queue.paused);
			
			if (r.queue.speedlimit !== speedLimit()) {
				disableSpeedLimitUpdate = true;
				speedLimit(r.queue.speedlimit);
				disableSpeedLimitUpdate = false;
			}
		
			$.each(r.queue.slots, function() {
				var data = this;
				var existingItem = ko.utils.arrayFirst(items(), function(i) { return i.id == data.nzo_id; });
				data.priority = priorities[data.priority];
			
				if (existingItem) {
					existingItem.updateFromData(data);
					currentItemIds.splice(currentItemIds.indexOf(data.nzo_id), 1);
				}
				else {
					items.push(new QueueModel(data));
					console.log("Added new queue item", data);
				}
			});
		
			// remove any items that weren't returned by updated data
			$.each(currentItemIds, function() { 
				var id = this.toString();
				items.remove(ko.utils.arrayFirst(items(), function(i) { return i.id == id; })); 
			});
		
			items.sort(function(a, b) { return a.index() < b.index() ? -1 : 1; });
			
			updater.updateFromData({ downloadUrl: r.queue.new_rel_url, latestVersion: r.queue.new_release });
			
			if (force)
				SetPages();
			
			if (isFirstLoad())	
				isFirstLoad(false);
		})
		.fail(function(e) {
			if (e.statusText === "abort")
				return;
				
			console.error("Error loading queue", e);
		});
	};
	
	var disableSpeedLimitUpdate = false;
	var setSpeedLimit = function(speedLimit) {
		if (disableSpeedLimitUpdate)
			return;
			
		console.log("Changing speed limit");
		
		var targetState = !isPaused();
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "config", name: "speedlimit", value: speedLimit, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r && r.status == true)
				console.log("Changed speed", r);
		})
		.fail(function(e) {
			console.error("Error changing speed limit", this, e);
		});
	};
	
	var clearSpeedLimit = function() {
		speedLimit(0);
	};

	var SetPages = function() {
    	// reset paging
    	var pagesToAdd = [];
    	var page = currentPage();
    	var totalPages = Math.ceil(itemsTotal() / itemsPerPage());
    	var start = page - 2 <= 0 
    		? 0 
    		: page + 2 > totalPages 
    			? totalPages - 5
    			: page - 2;
    	var end = start + 5 > totalPages - 1 ? totalPages - 1 : start + 5;

    	pagesToAdd.push({ title: 'Prev', index: page-1, state: page == 0 ? "disabled" : "" });
    	for (var i = start; i <= end; i++) 
    		pagesToAdd.push({ title: i + 1, index: i, state: page == i ? "active" : "" });
    	pagesToAdd.push({ title: 'Next', index: page + 1, state: page == totalPages - 1 ? "disabled" : "" });
    	
    	pages(pages);
	};
	
	var selectPage = function(page) {
		if (page.state != "")
			return;
			
		currentPage(page.index);
		refresh({ force: true });
	}

	var showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
	var hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }
	
	// public properties
	itemsPerPage = itemsPerPage;
	self.categories = categories;
	self.options = options;
	self.priorities = priorities;
	self.scripts = scripts;
	self.showDownloadSpeed = showDownloadSpeed;
	self.isPaused = isPaused;
	self.speedLimit = speedLimit;
	self.hasSpeedLimit = hasSpeedLimit;
	self.downloadSpeed = downloadSpeed;
	self.timeRemaining = timeRemaining;
	self.isEmpty = isEmpty;
	self.items = items;
	self.isFirstLoad = isFirstLoad;
	self.hasMultiplePages = hasMultiplePages;
	self.pages = pages;
	self.updater = updater;
	
	// public methods
	self.refresh = refresh;
	self.selectPage = selectPage;
	self.clearSpeedLimit = clearSpeedLimit;
	self.setSpeedLimit = setSpeedLimit;
	self.moveItem = moveItem;
	self.removeItem = removeItem;
	self.toggleQueueState = toggleQueueState;
};

var HistoryModel = function(data) {
	var self = this;
	
	var id;
	var index = ko.observable();
	var name = ko.observable();
	var category = ko.observable();
	var status = ko.observable();
	var path = ko.observable();
	var size = ko.observable();
	var sizeBytes = ko.observable();
	var script = ko.observable();
	var stages = ko.observableArray();
	var time = ko.observable();
	var url = ko.observable();
	var infoUrl = ko.observable();
	var actionLine = ko.observable();
	var showMore = ko.observable(false);
	var completed = ko.observable();
	
	var completedDate = ko.observable();
	var currentDate = ko.observable(new XDate());
	var completedOnDaysAgo = ko.computed(function() {
    	var date = completedDate();
    	var dateNow = currentDate();
    	
    	return date ? date.diffDays(dateNow) : -1;
	}, self);
	
	var completedOnDay = ko.computed(function() {
		var date = completedDate();
		return date ? date.toString("dddd") : "";
	}, self);
	
	var completedOnDate = ko.computed(function() {
		return completedDate() ? completedDate().toString("MM/dd/yy hh:mm TT") : "";
	}, self);
	
	var completedOn = ko.computed(function() {
		var daysDiff = completedOnDaysAgo();
		var dayString = completedOnDay();
		var dateString = completedOnDate();
		var ret = null;
		
		if (daysDiff < 7)
			if (daysDiff > 3)
				ret = "last " + dayString;
			else if (daysDiff > 1)
				ret = dayString;
			else if (daysDiff > 0.5)
				ret = completedDate().getDay() == currentDate().getDay() ? "today" : "yesterday";
			else if (daysDiff > 0.1)
				ret = "a few hours ago";
			else
				ret = "just now";
		
		return ret ? ret + " (" + dateString + ")" : dateString;
	}, self);
	
	var toggleMore = function() {
		showMore(!showMore());
	};
	
	var state = function(v) {
		var currentStatus = status().toLowerCase();
		
		if (currentStatus != "completed" && currentStatus != "failed" && currentStatus != "queued")
		  currentStatus = "processing";
		
		return v.toLowerCase() === currentStatus;
	};
	
	var updateFromData = function(data) {
		id = data.nzo_id;
		index(data.index);
		name($.trim(data.name));
		category(data.category == "*" ? "Default" : data.category);
		status(data.status);
		path(data.path);
		size(data.size || "--");
		sizeBytes(data.bytes);
		script(data.script);
		stages(data.stage_log);
		time(data.download_time);
		url(data.url);
		infoUrl(data.url_info);
		actionLine(data.action_line);
		
		var date = new Date(0);
		date.setUTCSeconds(data.completed);
		completedDate(new XDate(date));
		completed(date);
		
		window.setInterval(function() { currentDate(new XDate()); }, 3600000); // once per hour
	};
	
	updateFromData(data);
	
	// public methods
	self.updateFromData = updateFromData;
	self.toggleMore = toggleMore;
	self.state = state;
	
	// public properties
	self.id = id;
	self.index = index;
	self.name = name;
	self.category = category;
	self.status = status;
	self.path = path;
	self.size = size;
	self.sizeBytes = sizeBytes;
	self.script = script;
	self.stages = stages;
	self.time = time;
	self.url = url;
	self.infoUrl = infoUrl;
	self.actionLine = actionLine;
	self.completed = completed;
	self.completedOn = completedOn;
	self.showMore = showMore;
};

var HistoryListModel = function() {
  var self = this;
    
  // constants/defaults
	var refreshXhr;
	var defaultItemsPerPage = 5;
	
	var itemsTotal = ko.observable(0);
	var items = ko.observableArray();
	var currentPage = ko.observable(0);
	var pages = ko.observableArray([]);
	var isFirstLoad = ko.observable(true);
	var itemsPerPageInt = ko.observable();
	var itemsPerPage = ko.computed({
		read: function() { 
			itemsPerPageInt(parseInt(localStorage.historyItemsPerPage || defaultItemsPerPage)); 
			return itemsPerPageInt(); 
		},
		write: function(v) { 
			if (!v || isNaN(v) || parseInt(v) <= 0)
				v = defaultItemsPerPage;
			localStorage.historyItemsPerPage = v; 
			itemsPerPageInt(v); 
		}
	}, self);

	var isEmpty = ko.computed(function() {
		return items().length <= 0;
	}, self);
	
	var hasMultiplePages = ko.computed(function() {
		return itemsTotal() / itemsPerPage() > 1;
	}, self);
	
	// subscriptions
	itemsPerPage.subscribe(function(v) {
		refresh({ force: true });
	});
	
	itemsTotal.subscribe(function(v) {
		SetPages();
	}, self);
	
	currentPage.subscribe(function(v) {
		SetPages();
	}, self);
	
	var clear = function() {
		if (!confirm("Are you sure you want to clear all history?"))
			return;
		
		console.log("Clearing all history");
		
    $.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "history", name: "delete", value: "all", output: "json", apikey: apiKey } }))
    .then(function(r) {
      if (r.status == true)
        items.removeAll();
    })
    .fail(function(e) {
      console.error("Error clearing all history", e);
    });
  };
	
	var removeItem = function() {
		var itemToDelete = this;
		
		if (!confirm("Are you sure you want to delete this?"))
			return;
		
		console.log("Removing history item", itemToDelete);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "history", name: "delete", value: itemToDelete.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true) {
				items.remove(itemToDelete);
				refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error deleting history item", itemToDelete, e);
		});
  };
	
	var retryItem = function() {
		var itemToRetry = this;
		
		console.log("Retrying item", itemToRetry);
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "retry", value: itemToRetry.id, output: "json", apikey: apiKey } }))
		.then(function(r) {
			if (r.status == true) {
				refresh({ force: true });
			}
		})
		.fail(function(e) {
			console.error("Error retrying item", itemToRetry, e);
		});
  };
	
	var refresh = function(opts) {
		var force = opts && opts.force == true || false;
		
		if (!force && refreshXhr && refreshXhr.readyState != 4)
			return;
		
		if (refreshXhr && refreshXhr.readyState != 4)
			refreshXhr.abort();
			
		refreshXhr = $.ajax({ 
			url: "tapi", 
			type: "GET", 
			cache: false, 
			data: { 
				mode: "history", 
				start: currentPage() * itemsPerPage(), 
				limit: itemsPerPage(),
				output: "json", 
				apikey: apiKey 
			} 
		});
		
		$.when(refreshXhr)
		.then(function(r){
			if (!r)
				return;
			
			var currentItemIds = $.map(items(), function(i) { return i.id; });
			
			if (r.history.noofslots != itemsTotal())
				itemsTotal(r.history.noofslots);
			
			$.each(r.history.slots, function(index) {
				var data = this;
				data.index = index;
				var existingItem = ko.utils.arrayFirst(items(), function(i) { return i.id == data.nzo_id; });
				
				if (existingItem) {
					existingItem.updateFromData(data);
					currentItemIds.splice(currentItemIds.indexOf(existingItem.id), 1);
				}
				else {
					items.splice(0, 0, new HistoryModel(data));
					console.log("Added new history item", data);
				}
			});
			
			// remove any items that weren't returned by updated data
			$.each(currentItemIds, function() {
				var id = this.toString();
				items.remove(ko.utils.arrayFirst(items(), function(i) { return i.id == id; })); 
			});
			
			items.sort(function(a, b) { return a.index() < b.index() ? -1 : 1; });
			
			if (force)
				SetPages();
			
			if (isFirstLoad())	
				isFirstLoad(false);
		})
		.fail(function(e) {
			if (e.statusText === "abort")
				return;
				
			console.error("Error loading history", e);
		});
	};
	
	var showItem = function(e) { if (e.nodeType === 1) $(e).hide().fadeIn() }
	var hideItem = function(e) { if (e.nodeType === 1) $(e).fadeOut(function() { $(e).remove(); }) }

	var SetPages = function() {
    	// reset paging
    	var pagesToAdd = [];
    	var page = currentPage();
    	var totalPages = Math.ceil(itemsTotal() / itemsPerPage());
    	var start = page - 2 <= 0 
    		? 0 
    		: page + 2 > totalPages 
    			? totalPages - 4
    			: page - 2;
    	var end = start + 4 > totalPages - 1 ? totalPages - 1 : start + 4;

    	pagesToAdd.push({ title: 'Prev', index: page - 1, state: page == 0 ? "disabled" : "" });
    	for (var i = start; i <= end; i++) 
    		pagesToAdd.push({ title: i + 1, index: i, state: page == i ? "active" : "" });
    	pagesToAdd.push({ title: 'Next', index: page + 1, state: page == totalPages - 1 ? "disabled" : "" });
    	
    	pages(pagesToAdd);
	};
	
	var selectPage = function(page) {
		if (page.state != "")
			return;
			
		currentPage(page.index);
		refresh({ force: true });
	}
	
	// public properties
	self.itemsPerPage = itemsPerPage;
	self.items = items;
	self.isEmpty = isEmpty;
	self.isFirstLoad = isFirstLoad;
	self.hasMultiplePages = hasMultiplePages;
	self.pages = pages;
	
	// public methods
	self.refresh = refresh;
	self.clear = clear;
	self.selectPage = selectPage;
	self.retryItem = retryItem;
	self.removeItem = removeItem;
};

var UpdaterModel = function() {
	var self = this;
	
	// constants
	var currentVersion = 0.5;
	var remoteRepository = "http://aforty.myftp.org/sabnzbd-knockstrap/";
	var checkIntervalMilliseconds = 86400000; // 1 day
	
	var updateHidden = ko.computed({
		read: function() { return sessionStorage.hideUpdate == "1"; },
		write: function(v) { sessionStorage.hideUpdate = v ? "1" : "0"; }
	}, self);
	
	var downloadUrlInternal = ko.observable(localStorage.downloadUrl);
	var downloadUrl = ko.computed({
		read: function() { return downloadUrlInternal(); },
		write: function(v) { localStorage.downloadUrl = v; downloadUrlInternal(v); }
	}, self);
	
	var latestVersionInternal = ko.observable(parseFloat(localStorage.latestVersion));
	var latestVersion = ko.computed({
		read: function() { return latestVersionInternal(); },
		write: function(v) { localStorage.latestVersion = v; latestVersionInternal(v); }
	}, self);

	var updateAvailable = ko.computed(function() {
		return latestVersion() > currentVersion;
	}, self);
	
	var versionCheckDate = ko.computed({
		read: function() { return new XDate(parseInt(localStorage.versionCheckDate || 0)); },
		write: function(v) { localStorage.versionCheckDate = v.getTime(); }
	}, self);
	
	var versionHistoryInternal = ko.observable(JSON.parse(localStorage.versionHistory || "{}"));
	var versionHistory = ko.computed({
		read: function() { return versionHistoryInternal(); },
		write: function(v) { localStorage.versionHistory = JSON.stringify(v); versionHistoryInternal(v); }
	}, self);
	
	var versionHistorySinceThis = ko.computed(function() {
		return ko.utils.arrayFilter(versionHistory(), function(i) { 
			return parseFloat(i.version) > currentVersion;
		});
	}, self);
	
	var showUpdateBanner = ko.computed(function() {
		return updateAvailable() && !updateHidden();
	}, self);
	
	var CheckForUpdates = function() {
		if (updateAvailable() || (new XDate()).addMilliseconds(-1 * checkIntervalMilliseconds) < versionCheckDate())
			return;
		
		console.log("Checking for new theme version");
		$.when($.ajax({ url: remoteRepository + "versions.json", type: "GET", dataType: "json", cache: false }))
		.then(function(r) {
			if (!r)
				return;
			
			if (r.latestFileName.match(/^https?:/g))
			  downloadUrl(r.latestFileName);
			else
			  downloadUrl(remoteRepository + r.latestFileName);
			  
			latestVersion(r.latestVersion);
			versionHistory(r.versions);
			versionCheckDate(new XDate());
		})
		.fail(function(e) {
			console.error("Error retrieving remote version manifest", e);
		});
	};
	
	var remindMeLater = function() {
		updateHidden(true);
	};
	
	// public properties
	self.downloadUrl = downloadUrl;
	self.showUpdateBanner = showUpdateBanner;
	
	// public methods
	self.remindMeLater = remindMeLater;
	self.versionHistorySinceThis = versionHistorySinceThis;
	
	// init
	CheckForUpdates();
	window.setInterval(function() { CheckForUpdates(); }, checkIntervalMilliseconds);
};

var SABUpdaterModel = function() {
	var self = this;
	
	var updateHidden = ko.computed({
		read: function() { return sessionStorage.hideSABUpdate == "1"; },
		write: function(v) { sessionStorage.hideSABUpdate = v ? "1" : "0"; }
	}, self);
	
	var downloadUrl = ko.observable();
	var latestVersion = ko.observable();
	
	var updateAvailable = ko.computed(function() {
		return downloadUrl() != "";
	}, self);
	
	var showUpdateBanner = ko.computed(function() {
		return updateAvailable() && !updateHidden();
	}, self);
	
	var remindMeLater = function() {
		updateHidden(true);
	};
	
	var updateFromData = function(vars) {
		downloadUrl(vars.downloadUrl);
		latestVersion(vars.latestVersion);
	};
	
	// public
	self.downloadUrl = downloadUrl;
	self.latestVersion = latestVersion;
	self.showUpdateBanner = showUpdateBanner;
	self.remindMeLater = remindMeLater;
	self.updateFromData = updateFromData;
};

var MainModel = function() {
	var self = this;
	
	// constants
	var defaultRefreshInterval = 2000;
	var refreshTimer;
  
	var refreshIntervalInternal = ko.observable(parseInt(localStorage.refreshInterval || defaultRefreshInterval));
	var refreshInterval = ko.computed({
		read: function() { return refreshIntervalInternal(); },
		write: function(v) { 
			v = isNaN(v) ? defaultRefreshInterval : parseInt(v);
			localStorage.refreshInterval = v; 
			refreshIntervalInternal(v); 
		}
	}, self);
	var refreshRate = ko.observable(refreshInterval() / 1000);
	
	refreshRate.subscribe(function(v) {
		if (!v || isNaN(v) || parseInt(v) <= 0) {
			refreshRate(refreshInterval() / 1000);
			return;
		}
		
		refreshInterval(v * 1000);
	});
	
	refreshInterval.subscribe(function(v) {
		setRefresh(v);
	});
	
  var isPaused = ko.observable(false);
	var pauseRefresh = ko.observable(false);
	var queue = new QueueListModel();
	var history = new HistoryListModel();
	var status = new StatusListModel();
	var updater = new UpdaterModel();
	
	var title = ko.computed(function() {
		if (!queue.showDownloadSpeed())
			return "SABnzbd";
		
		return "SABnzbd - " + queue.downloadSpeed();
	}, self);
    
	var setRefresh = function(interval) {
		if (refreshTimer)
			clearRefresh();
			
		refreshTimer = window.setInterval(function() { refresh(); }, interval);
	};
	
	var clearRefresh = function() {
		window.clearInterval(refreshTimer);
		refreshTimer = null;
	};
	
	// methods
	var refresh = function(opts) {
		if (!pauseRefresh()) {
			clearRefresh();
			
			queue.refresh(opts);
			history.refresh(opts);
			status.refresh(opts);
			
			setRefresh(refreshInterval());
		}
	};
	
	var restart = function() {
		if (!confirm("Are you sure you want to restart?"))
			return;
			
    	console.log("Restarting");
    	
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "restart", output: "json", apikey: apiKey } }))
		.fail(function(e) {
			console.error("Error restarting", this, e);
		});
	};
	
	var shutdown = function() {
		if (!confirm("Are you sure you want to shutdown?"))
			return;
			
		console.log("Shutting down");
		
		$.when($.ajax({ url: "tapi", type: "GET", cache: false, data: { mode: "shutdown", output: "json", apikey: apiKey } }))
		.fail(function(e) {
			console.error("Error shutting down", this, e);
		});
	};
    
	var addUrl = function(form) {
		$.when($.ajax({ url: "tapi", type: "POST", cache: false, data: { mode: "addid", name: $(form.url).val(), cat: "Default", script: "Default", priority: -100, pp: -1, apikey: apiKey } }))
		.then(function(r){
			$("#addNZB").modal("hide");
		})
		.fail(function(e){
			console.error("Error adding NZB via URL", e);
		});
	};
	
	var addFileFromForm = function(form){
	  return addFile($(form.file)[0].files[0]);
	};
	
	var addFile = function(file) {
		var data = new FormData();
		data.append("name", file);
		data.append("mode", "addfile");
		data.append("cat", "Default");    // Default category
		data.append("script", "Default"); // Default script
		data.append("priority", "-100");  // Default priority
		data.append("pp", "-1");          // Default post-processing options
		data.append("apikey", apiKey);
		
		$.when($.ajax({ url: "tapi", type: "POST", cache: false, processData: false, contentType: false, data: data }))
		.then(function(r){
			$("#addNZB").modal("hide");
		})
		.fail(function(e){
			console.error("Error adding NZB via URL", e);
		});
	};
	
	// public properties
	self.title = title;
	self.isPaused = isPaused;
	self.queue = queue;
	self.history = history;
	self.status = status;
	self.updater = updater;
	self.refreshRate = refreshRate;
	
	// public methods
	self.restart = restart;
	self.shutdown = shutdown;
	self.addUrl = addUrl;
	self.addFile = addFile;
	self.addFileFromForm = addFileFromForm;
	
	// initialize
	refresh({ force: true });
	setRefresh(refreshInterval());
};