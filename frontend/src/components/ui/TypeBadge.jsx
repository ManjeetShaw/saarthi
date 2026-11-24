import React from 'react';
import { User, Users } from 'lucide-react';
import Badge from './Badge.jsx';

export default function TypeBadge({ type, size = 'md' }) {
  const isGroup = type === 'group';
  const Icon = isGroup ? Users : User;
  return (
    <Badge variant={isGroup ? 'tertiary' : 'neutral'} size={size}>
      <Icon className="w-3 h-3" />
      {isGroup ? 'Group' : 'Individual'}
    </Badge>
  );
}
