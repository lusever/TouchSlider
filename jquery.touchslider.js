/*
TouchSlider 0.95
Licensed under the MIT license.
http://touchslider.com
*/
/*jslint browser: true, undef: true, sloppy: true, vars: true, white: true, nomen: true, plusplus: true, maxerr: 50, indent: 4 */
/*global WebKitCSSMatrix: false, jQuery: false, getComputedStyle: false */

(function($, undefined) {
	window.touchSlider = function(options) {
		options = options || {};
		var namespace = options.namespace || "touchslider",
			container = $(options.container);

		if (container.length !== 1) { // 0 or >1
			container.each(function() {
				touchSlider({container: this});
			});
			return;
		}

		options = $.extend({
				autoplay: false,
				delay: 3000,
				margin: 5,
				viewport: "." + namespace + "-viewport",
				prev: "." + namespace + "-prev",
				next: "." + namespace + "-next",
				pagination: "." + namespace + "-nav-item",
				currentClass: namespace + "-nav-item-current",
				duration: 350,
				mouseTouch: true
				// [container, scroller]
			}, options);

		var ret = {
				current: 0,
				step: step,
				next: next,
				prev: prev,
				start: start,
				stop: stop
			},
			isTouchWebkit = "ontouchstart" in window && "WebKitCSSMatrix" in window,
			touchstart = "touchstart", touchmove = "touchmove", touchend = "touchend",
			viewport = $(options.viewport, container),
			scroller = options.scroller ? $(options.scroller, container) : viewport.children(),
			slides = scroller.children(),
			pagination = $(options.pagination, container);

		if (scroller.css("position") !== "absolute") {
			var viewportHeight = viewport.height();
			viewport.css({
				height: viewportHeight,
				position: "relative"
			});
			scroller.css({
				position: "absolute",
				left: 0,
				height: viewportHeight,
				width: 100000
			});
		}

		if (!isTouchWebkit) {
			touchstart = "mousedown";
			touchmove = "mousemove";
			touchend = "mouseup";
		}

		slides.css("position", "absolute");

		// crossLeft( element )
		// crossLeft( element, pixels, [duration] )
		// crossLeft( element, function(index), [duration] )
		var crossLeft = isTouchWebkit
				? function(elem, px, duration) {
					if (px === undefined) {
						return new WebKitCSSMatrix(getComputedStyle(elem.jquery ? elem[0] : elem).webkitTransform).e;
					}
					elem.css({
						webkitTransitionDuration: duration ? duration + "ms" : "0",
						// http://jsperf.com/typeof-function-vs-instanceof/3
						webkitTransform: function(i){
							return "translate3d(" + (typeof px === "number" ? px : px.call(this, i)) + "px,0,0)";
						}
					});
				}
				: function(elem, px) {
					if (px === undefined) {
						return parseInt((elem.jquery ? elem[0] : elem).style.left, 10);
					}

					elem.css("left", px);
				};

		if (isTouchWebkit) {
			slides
				.css({
					webkitTransitionProperty: "-webkit-transform",
					webkitTransitionTimingFunction: "cubic-bezier(0,0,0.25,1)"
				});
		}
		crossLeft(slides.not(slides[0]), 10000);
		crossLeft(slides.eq(0), 0);

		var switching = (function() {
			var inViewport = [0],
				endCoords = [0], // for calc when an animation
				toComplete = $.noop;

			return {
				moving: false,
				init: function() {
					scroller.bind("webkitTransitionEnd", function() {
						toComplete();
					});
				},
				to: function(toIndex, opt) {
					opt = opt || {};
					if (toIndex >= slides.length) {
						toIndex = 0;
					} else if (toIndex < 0){
						toIndex = slides.length - 1;
					}
					var duration = options.duration,
						node = slides.eq(toIndex),
						indexInViewport = $.inArray(toIndex, inViewport),
						nodeLeft = 0;

					// http://bugs.jquery.com/ticket/10364
					scroller.stop();

					switching.moving = true;
					clearTimeout(autoPlayTimeout);

					if (indexInViewport !== -1) {
						nodeLeft = endCoords[indexInViewport];
					// add node if not exist
					} else {
						var i, nodeIndex = slides.index(node);
						// set position in viewport
						indexInViewport = undefined;

						if (opt.dirX === -1) {
							endCoords.unshift(0);
							inViewport.unshift(nodeIndex);
						} else if (opt.dirX === 1) {
							endCoords.push(0);
							inViewport.push(nodeIndex);
						} else {
							for (i = inViewport.length - 1; i >= 0; i--){
								if (inViewport[i] < nodeIndex) {
									endCoords.splice(i + 1, 0, 0);
									inViewport.splice(i + 1, 0, nodeIndex);
									indexInViewport = 0; // temp
									break;
								}
							}
							if (indexInViewport === undefined) {
								endCoords.unshift(endCoords);
								inViewport.unshift(nodeIndex);
							}
						}
						indexInViewport = $.inArray(nodeIndex, inViewport);

						// set start coordinates
						if (indexInViewport === 0) {
							nodeLeft = endCoords[1] - (node.outerWidth() + options.margin);
							crossLeft(node, nodeLeft);
							endCoords[indexInViewport] = nodeLeft;
						} else if (indexInViewport === inViewport.length - 1) {
							nodeLeft = endCoords[indexInViewport - 1] + slides.eq(inViewport[indexInViewport - 1]).outerWidth() + options.margin;
							crossLeft(node, nodeLeft);
							endCoords[indexInViewport] = nodeLeft;
						} else {
							var nodeWidth = node.outerWidth();
							node.css("opacity", 0);
							// for example: inViewport = [0,1,2,3,4] and indexInViewport = 2
							// center, [2]
							nodeLeft = endCoords[indexInViewport+1] - Math.round((nodeWidth + options.margin) / 2);
							endCoords[indexInViewport] = nodeLeft;
							crossLeft(node, nodeLeft);

							// left calc, [0,1]
							var leftInL = nodeLeft, l = inViewport.length;
							for (i = indexInViewport - 1; i >= 0; i--) {
								leftInL -= slides.eq(inViewport[i]).outerWidth() + options.margin;
								endCoords[i] = leftInL;
							}

							// right calc, [3,4]
							var leftInR = nodeLeft;
							
							for (i = indexInViewport + 1; i < l; i++) {
								leftInR += slides.eq(inViewport[i]).outerWidth() + options.margin;
								endCoords[i] = leftInR;
							}

							for (i = 0; i < l; i++) {
								slides.eq(inViewport[i])
									.animate({ left: endCoords[i] }, {
										duration: duration,
										queue: false,
										complete: function() {
											if (node.is(this)) {
												node.animate({ opacity: 1 }, duration);
											}
										}
									});
							}
						}
					}

					if (opt.pxInMs) {
						duration = Math.min(Math.max(Math.round(Math.abs(crossLeft(scroller)) / opt.pxInMs), 100), duration);
					}

					toComplete = function() {
						crossLeft(slides.not(node), -10000);
						inViewport = [slides.index(node)];
						endCoords = [nodeLeft];
						if (opt.complete) {
							opt.complete();
						}
						switching.moving = false;
						autoPlay();
					};

					// go!
					if (!isTouchWebkit) {
						scroller.animate(
							{
								left: - nodeLeft
							}, {
								duration: duration,
								queue: false,
								complete: toComplete
						});
					} else {
						crossLeft(scroller, - nodeLeft, duration);
					}

					ret.current = toIndex;
					changedView(toIndex);
				},

				stop: function() {
					if (isTouchWebkit) {
						crossLeft(scroller, crossLeft(scroller));
					} else {
						scroller.stop();
					}
				},

				moveStart: function(e) {
					switching.moving = true;
					clearTimeout(autoPlayTimeout);
					scroller.stop();

					switching.startPageX = e.pageX;
					// if deceleration in progress
					var scrollerLeft = crossLeft(scroller),
						lastLeft;

					switching.leftCount = scrollerLeft;
					if (inViewport[0] === 0) {
						if (endCoords[0] + scrollerLeft > 0) {
							switching.leftCount = scrollerLeft + (endCoords[0] + scrollerLeft) * 3;
						}
					} else if (inViewport[inViewport.length - 1] === slides.length - 1) {
						lastLeft = endCoords[inViewport.length - 1] + scrollerLeft;
						if (lastLeft < 0) {
							switching.leftCount = scrollerLeft + lastLeft * 3;
						}
					}
				},

				move: function(e, previousPageX) {
					var diffX = e.pageX - previousPageX,
						scrollerLeft = crossLeft(scroller),
						first = slides.eq(inViewport[0]),
						lastIndex = inViewport.length - 1,
						last = slides.eq(inViewport[lastIndex]),
						add, addLeft, deceleration;

					switching.leftCount += diffX;
					// add slide to left
					if (diffX > 0) {
						// while is used in case of fast moving
						while (inViewport[0] !== 0 && scrollerLeft + endCoords[0] + diffX > options.margin) {
							add = slides.eq(inViewport[0] - 1); // or "first.index() - 1"
							addLeft = endCoords[0] - add.outerWidth() - options.margin;
							crossLeft(add, addLeft);
							endCoords.unshift(addLeft);
							inViewport.unshift(inViewport[0] - 1);
							lastIndex++;
							first = add;
						}
					}
					// deceleration in left
					if ((
						    (diffX > 0 && scrollerLeft + endCoords[0] + diffX > 0)
						 || (diffX < 0 && scrollerLeft + endCoords[0] > 0)
						) && inViewport[0] === 0
					) {
						deceleration = Math.min(Math.round((switching.leftCount + endCoords[0]) / 4), viewport.innerWidth() / 2);
						diffX = deceleration - (scrollerLeft + endCoords[0]);
					}

					// add slide to right
					if (diffX < 0) {
						while (!last.is(slides.last()) && scrollerLeft + endCoords[lastIndex] + diffX + last.outerWidth() + options.margin < viewport.innerWidth()) {
							add = slides.eq(inViewport[lastIndex] + 1);
							addLeft = endCoords[lastIndex] + last.outerWidth() + options.margin;
							crossLeft(add, addLeft);
							endCoords.push(addLeft);
							inViewport.push(inViewport[lastIndex++] + 1);
							last = add;
						}
					}
					// deceleration in right
					if ((
						    (diffX > 0 && scrollerLeft + endCoords[lastIndex] < 0)
						 || (diffX < 0 && scrollerLeft + endCoords[lastIndex] + diffX < 0)
						) && last.is(slides.last())
					) {
						deceleration = Math.max(Math.round((switching.leftCount + endCoords[lastIndex]) / 4), - viewport.innerWidth() / 2);
						diffX = deceleration - (scrollerLeft + endCoords[lastIndex]);
					}

					crossLeft(scroller, scrollerLeft + diffX);
				},

				moveEnd: function(e, pxInMs, directionX, startTime, distX, distY) {
					// TODO clear inViewport
					var inViewportLength = inViewport.length,
						scrollerLeft = crossLeft(scroller),
						toIndex = inViewportLength - 1,
						opt;
					if (endCoords[0] + scrollerLeft > 0) { // space in left
						toIndex = 0;
					} else if (endCoords[inViewport.length - 1] + scrollerLeft < 0) { // space in right
						/* nothing */
					} else {
						opt = {pxInMs: pxInMs};
						// maximum area
						var i, right,
							maximumInViewport = inViewportLength - 1,
							viewportWidth = viewport.innerWidth();
						for (i = 0 ; i < inViewportLength - 1; i++ ) { // no need check last
							right = endCoords[i] + slides.eq(inViewport[i]).outerWidth() + scrollerLeft;
							if (right > 0 && right > viewportWidth - (endCoords[i+1] + scrollerLeft)) {
								maximumInViewport = i;
								break;
							}
						}

						if (onFly) {
							toIndex = maximumInViewport;
						} else {
							var touched = inViewportLength - 1,
								scrollerOffsetLeft = Math.round(scroller.offset().left); // cast
							for (i = 0; i < inViewportLength; i++ ) {
								if (endCoords[i] + scrollerOffsetLeft > e.pageX) {
									touched = i - 1;
									break;
								}
							}
							toIndex = maximumInViewport;
							// 5% of diagonal
							if (maximumInViewport === touched &&
								e.timeStamp - startTime < 1000 &&
								distX + distY > Math.sqrt(Math.pow(viewport.height(), 2) + Math.pow(viewportWidth, 2)) * 0.05)
							{
								toIndex = Math.max(0, Math.min(inViewportLength - 1, toIndex + directionX));
							}
						}
					}

					toIndex = inViewport[toIndex];
					switching.to(toIndex, opt);
				}
			};
		}());

		switching.init();

		if (isTouchWebkit) {
			var onFly = false;
			scroller.bind("webkitTransitionStart", function() {
				onFly = true;
			});
			scroller.bind("webkitTransitionEnd", function() {
				onFly = false;
			});
		}

		function changedView(index) {
			pagination.removeClass(options.currentClass)
				.eq(index).addClass(options.currentClass);
		}

		// set item or next
		function step(toIndex, complete) {
			var currentIndex = ret.current;
			if (currentIndex !== toIndex) {
				toIndex = toIndex !== undefined ? toIndex : currentIndex + 1;

				switching.to(toIndex, { complete: complete });
			}
		}

		function next(complete) {
			switching.to(ret.current + 1, { dirX: 1, complete: complete });
		}

		function prev(complete) {
			switching.to(ret.current - 1, { dirX: -1, complete: complete });
		}

		/* Autoplay */
		var mouseInViewport = false,
			isPlay = false,
			autoPlayTimeout;

		viewport.hover(function() {
				clearTimeout(autoPlayTimeout);
				mouseInViewport = true;
			}, function() {
				mouseInViewport = false;
				autoPlay();
		});

		function autoPlay() {
			if (isPlay) {
				start();
			}
		}

		function start() {
			isPlay = true;
			if (!mouseInViewport) {
				clearTimeout(autoPlayTimeout);
				autoPlayTimeout = setTimeout(function() {
					if (!switching.moving && !mouseInViewport) {
						next();
					}
				}, options.delay);
			}
			return options.container;
		}

		function stop() {
			clearTimeout(autoPlayTimeout);
			isPlay = false;
			return options.container;
		}

		/* Navigation */
		// not use delegate(), for correct selection in mobile webkit
		pagination.click(function() {
			step(pagination.index(this));
		});

		// left/right button
		$(options.prev, container).click(function() {
			prev();
		});

		$(options.next, container).click(function() {
			next();
		});

		function initTouch() {
			var doc = $(document), startTime, defaultPrevented,
				moving = false, // if mouseup in stopPropogation area
				times, coords, // for accelerate
				startPageX, previousPageX, distX, absDistX, startLeft,
				startPageY, previousPageY, distY, absDistY,
				start = function(e) {
					if (e.which > 1) {
						return;
					}

					if (moving) {
						doc.triggerHandler(touchend + "." + namespace);
					}

					moving = true;
					defaultPrevented = false,
					startTime = e.timeStamp;
					distX = distY = 0;

					times = [0, 0, 0, startTime];

					// delegate to document for coorect touches length
					if (e.originalEvent.touches) {
						doc.one(touchstart, touchStart);
						return;
					}

					// no drag images
					e.preventDefault();

					startPageX = previousPageX = e.pageX;
					startPageY = previousPageY = e.pageY;
					startLeft = scroller[0].offsetLeft;

					coords = [0, 0, 0, startPageX];

					doc.bind(touchmove, move);
					doc.one(touchend + "." + namespace, end);

					switching.moveStart(e);
				},
				touchStart = function(e) {
					if (e.originalEvent.touches.length !== 1) {
						return;
					}

					startPageX = previousPageX = e.pageX = e.originalEvent.touches[0].pageX;
					startPageY = previousPageY = e.pageY = e.originalEvent.touches[0].pageY;
					absDistX = absDistY = 0;

					startLeft = new WebKitCSSMatrix(window.getComputedStyle(scroller[0]).webkitTransform).e;

					coords = [0, 0, 0, startPageX];

					doc.bind(touchmove, move);
					doc.one(touchend, end);

					switching.moveStart(e);
				},
				move = function(e) {
					var pageX, pageY;
					if (e.originalEvent.touches && isTouchWebkit) {
						if (e.originalEvent.touches.length !== 1) {
							return;
						}
						pageX = e.pageX = e.originalEvent.touches[0].pageX;
						pageY = e.pageY = e.originalEvent.touches[0].pageY;

						// iphone allow scrolling page
						absDistX += Math.abs(pageX - previousPageX);
						absDistY += Math.abs(pageY - previousPageY);

						// when long touching in one direction and then want to switch
						if (Math.abs(absDistX - absDistY) > 50) {
							var absDistXOld = absDistX;
							absDistX = Math.min(100, Math.max(0, absDistX - absDistY));
							absDistY = Math.min(100, Math.max(0, absDistY - absDistXOld));
						}

						if (pageX === previousPageX) {
							return;
						}

						// to scroll in a single direction
						if (!defaultPrevented) {
							if (absDistX > absDistY) {
								e.preventDefault();
								defaultPrevented = true;
							} else {
								end(e);
							}
						}
					} else {
						pageX = e.pageX;
						pageY = e.pageY;

						if (pageX === previousPageX) {
							return;
						}

						if (/msie/.test(navigator.userAgent.toLowerCase())) {
							e.preventDefault();
						}
					}

					distX += Math.abs(pageX - previousPageX);
					distY += Math.abs(pageY - previousPageY);
					times.shift();
					times.push(e.timeStamp);

					coords.shift();
					coords.push(pageX);

					switching.move(e, previousPageX);

					previousPageX = pageX;
					previousPageY = pageY;

				},
				end = function(e) {
					moving = false;
					// mobile webkit browser fix
					if (!e.originalEvent || e.originalEvent.touches) {
						e.pageX = previousPageX;
						e.pageY = previousPageY;
					}
					doc.unbind(touchmove, move);

					var i = times.length, pxInMs = 0, directionX = 0; // accelerate
					while (--i > 0) {
						if (times[i-1]) {
							var diffCoords = coords[i] - coords[i - 1];
							pxInMs += Math.abs(diffCoords)/(times[i] - times[i - 1]);
							if (diffCoords !== 0) {
								directionX = diffCoords > 0 ? -1 : 1;
							}
						}
					}
					pxInMs = pxInMs/times.length;

					switching.moveEnd(e, pxInMs, directionX, startTime, distX, distY);
					onFly = false;

					if (distX + distY > 4) {
						viewport.one("click", function(e) {
							e.preventDefault();
						});
					}
				};
			viewport.bind(touchstart, start);
		}
		if (options.mouseTouch) {
			initTouch();
		}

		if (options.autoplay) {
			start();
		}

		container.data(namespace, ret);
	};

	$.fn.touchSlider = function(options) {
		options = options || {};
		options.container = this;
		touchSlider(options);
		return this;
	};
}(jQuery));
