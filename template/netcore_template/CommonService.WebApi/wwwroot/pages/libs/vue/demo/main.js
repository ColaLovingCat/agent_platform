const Home = { template: '<div><object type="text/html" data="./views/home.html"></object></div>' }
const About = { template: '<div><object type="text/html" data="./views/about.html"></object></div>' }

const router = new VueRouter({
    routes: [
        { path: '/home', component: Home },
        { path: '/about', component: About }
    ]
})

new Vue({
    el: '#app',
    router
})