# Mentions System

The Biensperience mentions system allows users to mention other users, destinations, and experiences in text content with interactive popovers.

## Components

### InteractiveTextArea

A textarea component with built-in mentions support that provides autocomplete suggestions and visibility controls.

```jsx
import InteractiveTextArea from '../components/InteractiveTextArea/InteractiveTextArea';

function MyComponent() {
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState('public');

  // Prepare entities for mentions
  const availableEntities = prepareMixedEntities({
    users: userList,
    destinations: destinationList,
    experiences: experienceList
  });

  return (
    <InteractiveTextArea
      value={text}
      onChange={setText}
      visibility={visibility}
      onVisibilityChange={setVisibility}
      availableEntities={availableEntities}
      entityData={entityDataMap}
      placeholder="Type @ to mention..."
    />
  );
}
```

**Props:**
- `value`: Current text value
- `onChange`: Change handler function
- `visibility`: Current visibility setting ('public', 'contributors', 'private')
- `onVisibilityChange`: Visibility change handler
- `availableEntities`: Array of entities available for mentioning
- `entityData`: Map of entityId -> entity data for popovers
- `placeholder`: Placeholder text
- `rows`: Number of textarea rows
- `disabled`: Whether the textarea is disabled

### MentionedText

A component for rendering text with interactive mentions and popovers.

```jsx
import MentionedText from '../components/MentionedText/MentionedText';

function DisplayComponent({ post }) {
  return (
    <div>
      <MentionedText
        text={post.content}
        entities={entityDataMap}
        onEntityClick={(type, id, entity) => {
          // Handle entity click (e.g., navigate to entity page)
        }}
      />
    </div>
  );
}
```

**Props:**
- `text`: Text containing mentions
- `entities`: Map of entityId -> entity data
- `onEntityClick`: Optional click handler for mentions
- `className`: Additional CSS classes

## Utilities

### mentions.js

Core mentions functionality for parsing, rendering, and managing mentions.

```javascript
import {
  parseMentions,
  renderTextWithMentions,
  createMention,
  MENTION_TYPES
} from '../utilities/mentions';

// Parse text for mentions
const segments = parseMentions("Check out @user:123's trip to @destination:456!");

// Create a mention
const mention = createMention(MENTION_TYPES.USER, 'user123');

// Render text with interactive mentions
const renderedText = renderTextWithMentions(text, entityData, onEntityClick);
```

### mentions-helpers.js

Helper functions for preparing entities and managing mention data.

```javascript
import {
  prepareMixedEntities,
  createEntityDataMap,
  extractEntityIdsFromText
} from '../utilities/mentions-helpers';

// Prepare entities for mentions
const availableEntities = prepareMixedEntities({
  users: userList,
  destinations: destinationList,
  experiences: experienceList
});

// Create entity data map for rendering
const entityData = createEntityDataMap([...users, ...destinations, ...experiences]);

// Extract entity IDs from text
const entityIds = extractEntityIdsFromText(text);
```

## Usage Example

See `MentionsExample.jsx` for a complete working example of the mentions system.

## Data Storage

Mentions are stored as plain text in the database using the format `@entityType:entityId`. For example:
- `@user:507f1f77bcf86cd799439011`
- `@destination:507f1f77bcf86cd799439012`
- `@experience:507f1f77bcf86cd799439013`

The frontend converts these to interactive links with popovers using the entity data.

## Visibility

The InteractiveTextArea includes a visibility dropdown with three options:
- **Public**: Visible to everyone
- **Contributors Only**: Visible only to contributors
- **Private**: Visible only to the author

## Styling

The mentions system includes CSS for:
- Interactive textarea with suggestions dropdown
- Mention links with hover effects
- Popover styling for entity details
- Responsive design for mobile devices

## Integration

To integrate mentions into your component:

1. Prepare available entities using `prepareMixedEntities()`
2. Create entity data map using `createEntityDataMap()`
3. Use `InteractiveTextArea` for input
4. Use `MentionedText` for display
5. Handle entity clicks for navigation or actions