Knockstrap
==================

### What is this?
Knockstrap is a theme for [SABnzbd](http://sabnzbd.org/), the popular automated Usenet download tool. It brings a larger, more modern, brighter and cleaner look to one of your favorite tools.

### Features
* Clean interface: Large fonts, clean layout, easy to navigate
* Responsive design: looks great on all your devices
* Rewritten: Completely rewritten from scratch, not based on Plush
* Update system: it will inform you when a new version of Knockstrap is available
* Uses KnockoutJS and Bootstrap

### How to I install it?
* [Download the latest version](https://github.com/aforty/sabnzbd-knockstrap/archive/master.zip)
* Extract the `Knockstrap` folder into `/path/to/sabnzbd/interfaces/knockstrap`
* Select `Knockstrap` from the available skins (`config->general->skin`)

Alternatively, you can clone directly from GitHub and I trust you to know how to do that. 

### It's missing something!
Yes I'm aware that despite my best efforts this still lacks in a few aspects behind the built-in Plush theme. Good news though, this is GitHub! So, fork the project, grab your favorite text editor, make the changes you need and send me a pull request. 

### Code? I only want to change the look...
So you know CSS? Right on, I made it so that you can easily change the look and feel while keeping the code base. Fork the project, add a new CSS file as `Knockstrap/templates/static/stylesheets/colorschemes/yourname.css`. Next time you relaunch SABnzbd you will see your color scheme in the themes drop down as 'Knockstrap - yourname'. Cool huh?

Is it good enough to share with everyone else? I'd love to include it, send a pull request so that you can get proper credit. 

### Why did you do this?
Why does anyone do anything? I got bored. Well, I also wanted a theme that would play well on both mobile and desktop, since mobile and tablet are quickly becoming my #1 way of using this tool. SABnzbd offers a secondary mobile skin, but separate sites for desktop and mobile? How 2005. I needed a responsive design. I found that there were some core layout problems and oddities that stopped me from giving this kind of responsive makeover to Plush. So I needed to redo this from scratch and the fastest way I knew how was Twitter's [Bootstrap](http://twitter.github.io/bootstrap/). So out of the box Knockstrap is responsive and looks great at any screen size. 

While I was at it, I wasn't going to use Cheetah's somewhat arcane markup language either. Template files with special markup that get parsed on the server on every request? No thanks. So I was going to rebuild this as a client side javascript app, pulling info as needed from the available json api. Client side MVVM anyone? Enter [Knockout](http://knockoutjs.com/). 

Combine these two and you have the magic sauce for a beautiful and responsive client side application worthy of SABnzbd. Hope you enjoy!

### I need to contact you!
Ok, follow me on Twitter [@aforty](http://twitter.com/aforty), or head over to the [original forum thread](http://forums.sabnzbd.org/viewtopic.php?t=12626) and post your thoughts or questions. 
