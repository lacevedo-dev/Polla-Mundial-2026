
import React from 'react';
import { Loader2, ChevronRight, Check } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  className = '', 
  isLoading = false,
  disabled,
  ...props 
}) => {
  const baseStyles = "relative inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300 active:scale-95 disabled:opacity-70 disabled:cursor-not-allowed overflow-hidden";
  
  const variants = {
    primary: isLoading 
      ? "bg-slate-800 text-white shadow-inner cursor-wait" 
      : "bg-black text-white hover:bg-slate-900 shadow-lg shadow-black/10",
    secondary: isLoading 
      ? "bg-lime-300 text-slate-900 shadow-inner cursor-wait" 
      : "bg-lime-400 text-slate-950 hover:bg-lime-500 shadow-lg shadow-lime-400/20",
    outline: isLoading 
      ? "bg-slate-50 border-2 border-slate-200 text-slate-400 cursor-wait" 
      : "bg-white border-2 border-slate-300 text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    ghost: isLoading 
      ? "bg-slate-50 text-slate-300 cursor-wait" 
      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
  };

  const sizes = {
    sm: "px-3 py-1.5 text-xs h-8",
    md: "px-5 py-2.5 text-sm h-11",
    lg: "px-8 py-3.5 text-base h-14"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`} 
      disabled={isLoading || disabled}
      {...props}
    >
      <span className={`flex items-center justify-center gap-2 transition-all duration-300 ${isLoading ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-100 scale-100'}`}>
        {children}
      </span>
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center animate-in fade-in zoom-in duration-500">
          <Loader2 className={`h-5 w-5 animate-spin ${variant === 'secondary' || variant === 'ghost' ? 'text-slate-900' : 'text-white'}`} />
        </div>
      )}
    </button>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input: React.FC<InputProps> = ({ className = '', isLoading, leftIcon, rightIcon, ...props }) => {
  return (
    <div className="relative w-full group">
      {leftIcon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-lime-600">
          {leftIcon}
        </div>
      )}
      <input 
        className={`w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-lime-400 focus:border-lime-500 outline-none transition-all text-slate-900 placeholder:text-slate-400 font-medium disabled:bg-slate-100 disabled:text-slate-400 disabled:border-slate-200 ${leftIcon ? 'pl-11' : ''} ${rightIcon || isLoading ? 'pr-11' : ''} ${className}`}
        {...props}
      />
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-lime-600" />
        ) : (
          rightIcon
        )}
      </div>
    </div>
  );
};

export const Checkbox: React.FC<{
  label: string;
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  className?: string;
  disabled?: boolean;
}> = ({ label, id, checked, onChange, className = '', disabled }) => {
  return (
    <div className={`flex items-center gap-3 cursor-pointer group ${className}`}>
      <div className="relative flex items-center h-5">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className="peer h-5 w-5 cursor-pointer appearance-none rounded-md border-2 border-slate-300 transition-all checked:border-lime-500 checked:bg-lime-500 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
        />
        <Check 
          size={14} 
          strokeWidth={4}
          className="absolute left-1 top-1 pointer-events-none opacity-0 transition-opacity peer-checked:opacity-100 text-slate-950" 
        />
      </div>
      <label
        htmlFor={id}
        className={`text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer group-hover:text-slate-900 transition-colors ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
      >
        {label}
      </label>
    </div>
  );
};

interface AutocompleteInputProps extends InputProps {
  suggestions: string[];
  onValueChange: (val: string) => void;
  suggestionTitle?: string;
  renderSuggestion?: (suggestion: string) => React.ReactNode;
}

export const AutocompleteInput: React.FC<AutocompleteInputProps> = ({ 
  suggestions, 
  onValueChange, 
  value, 
  suggestionTitle = "Sugerencias", 
  renderSuggestion,
  ...props 
}) => {
  const [showSuggestions, setShowSuggestions] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const currentValue = value?.toString() || '';

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    onValueChange(val);
    setShowSuggestions(true);
  };

  const selectSuggestion = (suggestion: string) => {
    onValueChange(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <Input 
        {...props} 
        value={currentValue} 
        onChange={handleChange} 
        onFocus={() => setShowSuggestions(true)}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="px-3 py-2 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
             <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">{suggestionTitle}</span>
             <span className="text-[8px] font-bold text-slate-300 uppercase">Contexto Inteligente</span>
          </div>
          <div className="max-h-60 overflow-y-auto">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                className="w-full text-left px-4 py-3 text-sm hover:bg-lime-50 transition-all border-b border-slate-50 last:border-0 group flex items-center justify-between"
                onClick={() => selectSuggestion(suggestion)}
              >
                <div className="flex-1 truncate">
                  {renderSuggestion ? renderSuggestion(suggestion) : (
                    <span className="text-slate-600 font-medium">{suggestion}</span>
                  )}
                </div>
                <ChevronRight size={14} className="text-slate-300 group-hover:text-lime-600 group-hover:translate-x-1 transition-all" />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export const EmailAutocompleteInput: React.FC<InputProps & { onValueChange: (val: string) => void }> = ({ onValueChange, value, ...props }) => {
  const domains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
  const val = value?.toString() || '';
  
  const suggestions = React.useMemo(() => {
    if (!val.includes('@')) return [];
    const [username, domainPart] = val.split('@');
    if (!username) return [];
    
    return domains
      .filter(d => d.startsWith(domainPart.toLowerCase()))
      .map(d => `${username}@${d}`)
      .filter(s => s !== val);
  }, [val]);

  return (
    <AutocompleteInput
      {...props}
      value={value}
      onValueChange={onValueChange}
      suggestions={suggestions}
      suggestionTitle="Sugerencias de Correo"
      renderSuggestion={(suggestion) => {
        const [user, domain] = suggestion.split('@');
        return (
          <div className="flex items-center">
            <span className="text-slate-400 font-medium truncate">{user}@</span>
            <span className="text-lime-700 font-black">{domain}</span>
          </div>
        );
      }}
    />
  );
};

export const Card: React.FC<{ children: React.ReactNode, className?: string }> = ({ children, className = '' }) => {
  return (
    <div className={`bg-white border border-slate-200 rounded-3xl shadow-sm hover:shadow-md transition-shadow p-6 ${className}`}>
      {children}
    </div>
  );
};

export const Badge: React.FC<{ children: React.ReactNode, color?: string }> = ({ children, color = 'bg-slate-100 text-slate-700' }) => {
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${color}`}>
      {children}
    </span>
  );
};
