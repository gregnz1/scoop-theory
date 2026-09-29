// Plays the hero's build-the-cup animation when the cup is on screen: straight away if it is
// visible on load, otherwise when you first scroll to it (on phones it sits below the headline).
// It plays again each time the cup comes back into view, and when it is tapped. The animation
// itself is CSS inside the hero drawing, which is off for anyone who reduces motion.
(() => {
  "use strict";
  const cup = document.querySelector(".hero-cup");
  if (!cup || !cup.getAnimations || !("IntersectionObserver" in window)) return;

  const animations = () => cup.getAnimations({subtree: true});
  const replay = () => animations().forEach(animation => {
    animation.cancel();
    animation.play();
  });
  const holdAtStart = () => animations().forEach(animation => {
    animation.pause();
    animation.currentTime = 0;
  });

  let first = true;
  let armed = false;
  new IntersectionObserver(([entry]) => {
    const shown = entry.isIntersecting ? entry.intersectionRatio : 0;
    if (first) {
      first = false;
      if (shown < 0.5) {
        armed = true;
        holdAtStart();
      }
      return;
    }
    if (armed && shown >= 0.5) {
      armed = false;
      replay();
    } else if (shown <= 0.1) {
      armed = true;
    }
  }, {threshold: [0, 0.1, 0.5]}).observe(cup);

  cup.addEventListener("click", replay);
})();
