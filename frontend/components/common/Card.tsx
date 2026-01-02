import { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export default function Card({ children, className = '', hover = true, style = {}, onClick }: CardProps) {
  return (
    <div
      className={`glass-card ${hover ? 'hover-enabled' : ''} ${className}`}
      style={style}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// Compound components for better reusability
Card.Header = function CardHeader({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-header ${className}`} style={{ marginBottom: '16px' }}>
      {children}
    </div>
  );
};

Card.Title = function CardTitle({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <h3 className={`card-title ${className}`} style={{ fontSize: '20px', fontWeight: '600', margin: 0 }}>
      {children}
    </h3>
  );
};

Card.Body = function CardBody({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-body ${className}`}>
      {children}
    </div>
  );
};

Card.Footer = function CardFooter({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`card-footer ${className}`} style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
      {children}
    </div>
  );
};
