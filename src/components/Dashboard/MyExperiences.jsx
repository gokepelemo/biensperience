import React, { useEffect, useState } from 'react';
import { Heading, Text, Button } from '../design-system';
import { Stack, FlexBetween } from '../Layout/Layout';
import { showUserCreatedExperiences } from '../../utilities/experiences-api';
import { Link } from 'react-router-dom';

export default function MyExperiences({ userId }) {
  const [experiences, setExperiences] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const resp = await showUserCreatedExperiences(userId);
        if (!mounted) return;
        setExperiences(resp?.data || resp || []);
      } catch (e) {
        // ignore - keep UI resilient
      } finally {
        if (mounted) setLoading(false);
      }
    }
    if (userId) load();
    return () => { mounted = false; };
  }, [userId]);

  return (
    <div style={{ height: '100%', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-primary)', border: '1px solid var(--color-border-light)' }}>
      <Heading level={4}>My Experiences</Heading>
      <Text size="sm" className="mb-3">Experiences you've created and shared</Text>

      <div style={{ overflow: 'auto', maxHeight: '40vh' }}>
        {loading && <Text size="sm">Loading...</Text>}
        {!loading && experiences.length === 0 && (
          <Text size="sm">No experiences created yet.</Text>
        )}

        {!loading && experiences.map((exp) => (
          <div key={exp._id} style={{ marginBottom: 'var(--space-3)' }}>
            <FlexBetween style={{ gap: 'var(--space-3)' }}>
              <div>
                <Link to={`/experiences/${exp._id}`} style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{exp.name || exp.title}</Link>
                <div style={{ fontSize: '0.9em', color: 'var(--color-text-muted)' }}>{exp.destination?.name || ''}</div>
              </div>
              <div>
                <Button as={Link} to={`/experiences/${exp._id}`} variant="outline" size="sm">View</Button>
              </div>
            </FlexBetween>
          </div>
        ))}
      </div>
    </div>
  );
}
