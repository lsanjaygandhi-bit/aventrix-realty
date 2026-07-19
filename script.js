const form = document.getElementById("propertyForm");
if (form) {
form.addEventListener("submit", async function (e) {
    e.preventDefault();

    try {

        const data = new FormData(form);

        const response = await fetch(form.action, {
            method: form.method,
            body: data,
            headers: {
                Accept: "application/json"
            }
        });

        console.log(response);

        if (response.ok) {

            alert("SUCCESS");

            form.style.display = "none";

            document.getElementById("success-message").style.display = "block";

            form.reset();

        } else {

            alert("Response Failed");

        }

  } catch (err) {
    console.log(err);
    alert(err);
}

});
}

const header = document.querySelector(".header");

window.addEventListener("scroll", () => {
    if (window.scrollY < 50) {
        header.classList.remove("hide");   // Top → Show Header
    } else {
        header.classList.add("hide");      // Anywhere else → Hide Header
    }
});
const propertyData = {
  "luxury-apartments": {
    title: "Luxury Apartments",
    price: "Contact for Price",
    location: "Chennai",
  },
  "premium-villas": {
    title: "Premium Villas",
    price: "Contact for Price",
    location: "Chennai",
  },
  "residential-plots": {
    title: "Residential Plots",
    price: "Contact for Price",
    location: "Chennai",
  },
  "crown-leaf": {
    title: "Crown Leaf",
    price: "Contact for Price",
    location: "Old Pallavaram",
  },
  "commercial-rent": {
    title: "Commercial for Rent",
    price: "Contact for Price",
    location: "Chennai",
  },
  "plot-sale": {
    title: "Plot for Sale",
    price: "Contact for Price",
    location: "Chennai",
  }
};
const menuToggle = document.getElementById("menuToggle");
const mainNav = document.querySelector(".main-nav");
const menuOverlay = document.getElementById("menuOverlay");

if (menuToggle && mainNav && menuOverlay) {

    function closeMenu() {
        menuToggle.classList.remove("active");
        mainNav.classList.remove("active");
        menuOverlay.classList.remove("active");
        document.body.style.overflow = "";
    }

    function openMenu() {
        menuToggle.classList.add("active");
        mainNav.classList.add("active");
        menuOverlay.classList.add("active");
        document.body.style.overflow = "hidden";
    }

    menuToggle.addEventListener("click", function () {
        if (mainNav.classList.contains("active")) {
            closeMenu();
        } else {
            openMenu();
        }
    });

    menuOverlay.addEventListener("click", closeMenu);

    mainNav.querySelectorAll("a").forEach(function (link) {
        link.addEventListener("click", closeMenu);
    });

    window.addEventListener("resize", function () {
        if (window.innerWidth > 768) {
            closeMenu();
        }
    });
}