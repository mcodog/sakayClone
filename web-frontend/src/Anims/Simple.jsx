export const scaleAnimation = {
  initial: { scale: 0 },
  animate: { scale: 1 },
  transition: { duration: 0.85, type: "spring" },
  variants: {
    initial: { scale: 0 },
    animate: { scale: 1 },
  },
};

export const buttonExitAnimation = {
  initial: { opacity: 1, scale: 1 },
  animate: { opacity: 0, scale: 0.8 },
  transition: { duration: 0.3 },
};

export const fadeInAnimation = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.5 },
  variants: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
  },
};

export const slideUpAnimation = {
  initial: { y: 100, opacity: 0 },
  animate: { y: 0, opacity: 1 },
  exit: { y: 100, opacity: 0 },
  transition: { duration: 0.8, type: "spring" },
  variants: {
    initial: { y: 100, opacity: 0 },
    animate: { y: 0, opacity: 1 },
  },
};

export const containerAnimation = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.3,
      duration: 0.3,
    },
  },
};
