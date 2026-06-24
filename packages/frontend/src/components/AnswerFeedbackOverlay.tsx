import { motion, AnimatePresence } from 'framer-motion';
import { useReducedMotion } from '../hooks/useReducedMotion';

interface Props {
  visible: boolean;
  isCorrect: boolean | null;
}

export const AnswerFeedbackOverlay = ({ visible, isCorrect }: Props) => {
  const reduced = useReducedMotion();

  const variants = reduced
    ? { hidden: { opacity: 1 }, visible: { opacity: 1 } }
    : {
        hidden: { opacity: 0, scale: 0.5 },
        visible: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 1.2 },
      };

  const shakeVariants = reduced
    ? { shake: {} }
    : {
        shake: {
          x: [0, -12, 12, -8, 8, -4, 4, 0],
          transition: { duration: 0.5 },
        },
      };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="feedback"
          className="absolute inset-0 flex items-center justify-center z-50 backdrop-blur-sm rounded-xl"
          style={{
            backgroundColor: isCorrect
              ? 'rgba(22, 163, 74, 0.85)'
              : 'rgba(220, 38, 38, 0.85)',
          }}
          variants={variants}
          initial="hidden"
          animate={isCorrect ? 'visible' : ['visible', 'shake']}
          exit="exit"
          transition={reduced ? { duration: 0 } : { duration: 0.35, ease: 'backOut' }}
        >
          {isCorrect ? (
            <span className="text-8xl select-none">✓</span>
          ) : (
            <motion.span
              className="text-8xl select-none"
              variants={shakeVariants}
              animate="shake"
            >
              ✗
            </motion.span>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
};
