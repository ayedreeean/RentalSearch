import { useState, useEffect, useRef } from 'react';

/**
 * Custom hook to animate a number counting up to a target value.
 * @param endValue The final value to animate to.
 * @param duration The duration of the animation in milliseconds.
 * @param config Optional configuration for startValue and callbacks.
 * @returns The current animated value.
 */
export function useAnimatedCountUp(
    endValue: number, 
    duration: number = 1500, 
    config?: { 
        startValue?: number; 
        onAnimationStart?: () => void; 
        onAnimationEnd?: () => void; 
    }
) {
    // Initialize count: if endValue is NaN (e.g. during initial load), reflect that. Otherwise, use startValue or 0.
    const [count, setCount] = useState(() => {
        if (typeof endValue === 'number' && !isNaN(endValue)) {
            return config?.startValue ?? 0;
        }
        return endValue; // Could be NaN initially
    });

    const frameRef = useRef<number>();
    const startTimeRef = useRef<number>();
    
    // Use a ref to store the target value for the current animation cycle.
    // This prevents issues if endValue prop changes while an animation is in progress.
    const currentAnimationTargetRef = useRef(endValue);

    useEffect(() => {
        // If endValue is not a number (e.g. NaN from an initial calculation),
        // set count to it directly and skip animation.
        if (typeof endValue !== 'number' || isNaN(endValue)) {
            setCount(endValue);
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current); // Cancel any ongoing animation
            }
            return;
        }

        // Determine the true start value for this animation cycle.
        // If the component is just mounting (or endValue was previously NaN), start from config.startValue or 0.
        // If endValue changes significantly, we might want to restart from 0 or the new config.startValue.
        const resolvedStartValue = config?.startValue ?? 0;
        
        setCount(resolvedStartValue); // Set the visual start of the animation.
        currentAnimationTargetRef.current = endValue; // Lock in the target for this animation run.

        config?.onAnimationStart?.();
        startTimeRef.current = performance.now(); // Get high-resolution timestamp

        const animate = (timestamp: number) => {
            if (!startTimeRef.current) { // Should be set, but as a fallback
                startTimeRef.current = timestamp;
            }
            const elapsed = timestamp - startTimeRef.current;
            const progress = Math.min(elapsed / duration, 1);
            
            const targetForThisFrame = currentAnimationTargetRef.current;

            let currentValue = resolvedStartValue + (targetForThisFrame - resolvedStartValue) * progress;

            // Ensure count does not overshoot the target
            if (resolvedStartValue < targetForThisFrame) { // Counting up
                currentValue = Math.min(currentValue, targetForThisFrame);
            } else { // Counting down (or staying the same)
                currentValue = Math.max(currentValue, targetForThisFrame);
            }
            
            setCount(currentValue);

            if (progress < 1) {
                frameRef.current = requestAnimationFrame(animate);
            } else {
                setCount(targetForThisFrame); // Ensure final value is exact
                config?.onAnimationEnd?.();
            }
        };

        frameRef.current = requestAnimationFrame(animate);

        return () => {
            if (frameRef.current) {
                cancelAnimationFrame(frameRef.current);
            }
        };
    }, [endValue, duration, config?.startValue]); // Rerun if endValue, duration, or explicitly provided startValue changes

    return count;
} 