/**
 * Example component demonstrating how to use InteractiveTextArea and MentionedText
 * This shows the complete mentions workflow
 *
 * @module MentionsExample
 */

import React, { useState, useMemo } from 'react';
import { Container, Row, Col, Card, Alert } from 'react-bootstrap';
import { logger } from '../../utilities/logger';
import InteractiveTextArea from '../InteractiveTextArea/InteractiveTextArea';
import MentionedText from '../MentionedText/MentionedText';
import {
  prepareMixedEntities,
  createEntityDataMap
} from '../../utilities/mentions-helpers';

// Sample data for demonstration
const sampleUsers = [
  { _id: 'user1', name: 'John Doe', username: 'johndoe', bio: 'Travel enthusiast' },
  { _id: 'user2', name: 'Jane Smith', username: 'janesmith', bio: 'Adventure seeker' }
];

const sampleDestinations = [
  { _id: 'dest1', name: 'Paris', city: 'Paris', country: 'France', description: 'City of Light' },
  { _id: 'dest2', name: 'Tokyo', city: 'Tokyo', country: 'Japan', description: 'Modern metropolis' }
];

const sampleExperiences = [
  { _id: 'exp1', name: 'Eiffel Tower Visit', destination: { name: 'Paris' }, description: 'Iconic landmark' },
  { _id: 'exp2', name: 'Sushi Making Class', destination: { name: 'Tokyo' }, description: 'Learn to make sushi' }
];

const MentionsExample = () => {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');
  const [savedPosts, setSavedPosts] = useState([]);

  // Prepare entities for mentions
  const availableEntities = useMemo(() => {
    return prepareMixedEntities({
      users: sampleUsers,
      destinations: sampleDestinations,
      experiences: sampleExperiences
    });
  }, []);

  // Create entity data map for rendering mentions
  const entityData = useMemo(() => {
    return createEntityDataMap([
      ...sampleUsers,
      ...sampleDestinations,
      ...sampleExperiences
    ]);
  }, []);

  const handleSave = () => {
    if (!text.trim()) return;

    const newPost = {
      id: Date.now(),
      text,
      visibility,
      timestamp: new Date()
    };

    setSavedPosts(prev => [newPost, ...prev]);
    setText('');
  };

  const handleEntityClick = (entityType, entityId, entity) => {
    logger.debug('Entity clicked', { entityType, entityId, entity });
    // Here you could navigate to the entity page or show a modal
  };

  return (
    <Container className="py-4">
      <Row>
        <Col md={8}>
          <Card>
            <Card.Header>
              <h4>Mentions System Demo</h4>
            </Card.Header>
            <Card.Body>
              <Alert variant="info">
                <strong>How to use:</strong> Type @ to mention users, destinations, or experiences.
                Try typing @john, @paris, or @eiffel to see suggestions.
              </Alert>

              <InteractiveTextArea
                value={text}
                onChange={setText}
                visibility={visibility}
                onVisibilityChange={setVisibility}
                availableEntities={availableEntities}
                entityData={entityData}
                placeholder="Share your travel experience... @mention friends, destinations, or experiences!"
                rows={4}
              />

              <div className="mt-3">
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={!text.trim()}
                >
                  Post
                </button>
              </div>
            </Card.Body>
          </Card>

          {/* Display saved posts */}
          <div className="mt-4">
            <h5>Recent Posts</h5>
            {savedPosts.length === 0 ? (
              <p className="text-muted">No posts yet. Try creating one above!</p>
            ) : (
              savedPosts.map(post => (
                <Card key={post.id} className="mb-3">
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start mb-2">
                      <small className="text-muted">
                        Posted {post.timestamp.toLocaleString()} • {post.visibility}
                      </small>
                    </div>
                    <div className="post-content">
                      <MentionedText
                        text={post.text}
                        entities={entityData}
                        onEntityClick={handleEntityClick}
                      />
                    </div>
                  </Card.Body>
                </Card>
              ))
            )}
          </div>
        </Col>

        <Col md={4}>
          <Card>
            <Card.Header>
              <h5>Available Entities</h5>
            </Card.Header>
            <Card.Body>
              <h6>Users</h6>
              <ul className="list-unstyled">
                {sampleUsers.map(user => (
                  <li key={user._id} className="mb-1">
                    <small>@{user.name} ({user._id})</small>
                  </li>
                ))}
              </ul>

              <h6 className="mt-3">Destinations</h6>
              <ul className="list-unstyled">
                {sampleDestinations.map(dest => (
                  <li key={dest._id} className="mb-1">
                    <small>@{dest.name} ({dest._id})</small>
                  </li>
                ))}
              </ul>

              <h6 className="mt-3">Experiences</h6>
              <ul className="list-unstyled">
                {sampleExperiences.map(exp => (
                  <li key={exp._id} className="mb-1">
                    <small>@{exp.name} ({exp._id})</small>
                  </li>
                ))}
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default MentionsExample;