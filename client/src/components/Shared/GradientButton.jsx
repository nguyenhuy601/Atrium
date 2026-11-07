import MotionButton from '../../motion/primitives/MotionButton';

/**
 * Gradient CTA — dùng MotionButton SoT (press/hover enterprise, không scale-105 marketing).
 */
const GradientButton = ({
  children,
  onClick,
  variant = 'primary',
  className = '',
  icon = null,
  disabled = false,
  type = 'button',
  ...rest
}) => {
  const variants = {
    primary: 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700',
    shell: 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-700 hover:to-teal-700',
    secondary: 'bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600',
    success: 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600',
    warm: 'bg-gradient-to-r from-orange-500 to-yellow-500 hover:from-orange-600 hover:to-yellow-600',
    friend: 'bg-gradient-to-r from-violet-500 to-blue-600 hover:from-violet-600 hover:to-blue-700',
  };

  return (
    <MotionButton
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${variants[variant] || variants.primary} px-6 py-3 rounded-xl font-semibold text-white shadow-lg hover:shadow-xl flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      {...rest}
    >
      {icon && <span className="text-xl">{icon}</span>}
      {children}
    </MotionButton>
  );
};

export default GradientButton;
