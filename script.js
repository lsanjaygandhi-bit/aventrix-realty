const header = document.querySelector(".header");

window.addEventListener("scroll", () => {
    if (window.pageYOffset === 0) {
        header.style.transform = "translateY(0)";
    } else {
        header.style.transform = "translateY(-100%)";
    }
});