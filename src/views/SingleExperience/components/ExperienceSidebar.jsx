/**
 * ExperienceSidebar
 *
 * Right-column sidebar for the SingleExperience view: date picker, ratings,
 * cost estimate, planning time, and the action buttons row. Pure relocation
 * from SingleExperience.jsx.
 */

import { Box, Flex } from '@chakra-ui/react';
import DatePickerSection from './DatePickerSection';
import ActionButtonsRow from './ActionButtonsRow';
import { StarRating, DifficultyRating } from '../../../components/RatingScale/RatingScale';
import PlanningTime from '../../../components/PlanningTime/PlanningTime';
import CostEstimate from '../../../components/CostEstimate/CostEstimate';
import { lang } from '../../../lang.constants';

export default function ExperienceSidebar({
  experience,
  experienceId,
  user,
  // Plan state
  userPlan,
  userHasExperience,
  selectedPlan,
  loading,
  plansLoading,
  displayedPlannedDate,
  // Date editing
  isEditingDate,
  setIsEditingDate,
  plannedDate,
  setPlannedDate,
  handleDateUpdate,
  handleAddExperience,
  pendingShift,
  onShiftDates,
  onKeepDates,
  // Modal mgmt
  isModalOpen,
  openModal,
  closeModal,
  setShowDatePickerState,
  handleOpenDeleteExperienceModal,
  MODAL_NAMES,
  // Action buttons
  handleExperience,
  handleShareExperience,
  planButtonRef,
  planBtnWidth,
  favHover,
  setFavHover,
  // Tab
  activeTab,
}) {
  return (
    <Box
      position={{ base: 'relative', lg: 'sticky' }}
      top={{ lg: '6' }}
      mb="6"
      css={{
        '@media (max-width: 991px)': {
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
        },
      }}
    >
      <Box
        bg="bg.muted"
        border="1px solid"
        borderColor="border"
        borderRadius="lg"
        p={{ base: '4', lg: '6' }}
        w={{ base: '100%', lg: 'auto' }}
      >
        <Box
          as="h3"
          fontSize={{ base: 'xl', lg: 'lg' }}
          fontWeight="semibold"
          color="fg"
          mb={{ base: '3', lg: '4' }}
          css={{ '@media (max-width: 991px)': { textAlign: 'center' } }}
        >
          Experience Details
        </Box>

        {/* Date Picker Section */}
        <DatePickerSection
          showDatePicker={isModalOpen(MODAL_NAMES.DATE_PICKER)}
          experience={experience}
          isEditingDate={isEditingDate}
          plannedDate={plannedDate}
          setPlannedDate={setPlannedDate}
          loading={loading}
          handleDateUpdate={handleDateUpdate}
          handleAddExperience={handleAddExperience}
          setShowDatePicker={setShowDatePickerState}
          setIsEditingDate={setIsEditingDate}
          lang={lang}
          pendingShift={pendingShift}
          onShiftDates={onShiftDates}
          onKeepDates={onKeepDates}
        />

        {/* Details List */}
        <Flex direction="column" gap={{ base: '3', lg: '4' }} mb={{ base: '4', lg: '6' }}>
          {experience.rating > 0 && (
            <Box css={{
              '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            }}>
              <Box color="fg.muted" fontSize={{ base: 'md', lg: 'sm' }} mb="1">Rating</Box>
              <Box color="fg" fontWeight="medium" fontSize={{ base: 'lg', lg: 'md' }}>
                <StarRating rating={experience.rating} size="md" showValue={true} />
              </Box>
            </Box>
          )}
          {experience.difficulty > 0 && (
            <Box css={{
              '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            }}>
              <Box color="fg.muted" fontSize={{ base: 'md', lg: 'sm' }} mb="1">Difficulty</Box>
              <Box color="fg" fontWeight="medium" fontSize={{ base: 'lg', lg: 'md' }}>
                <DifficultyRating difficulty={experience.difficulty} size="md" showValue={true} showLabel={true} variant="dots" />
              </Box>
            </Box>
          )}
          {experience.cost_estimate > 0 && (
            <Box css={{
              '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            }}>
              <Box color="fg.muted" fontSize={{ base: 'md', lg: 'sm' }} mb="1">Estimated Cost</Box>
              <Box color="fg" fontWeight="medium" fontSize={{ base: 'lg', lg: 'md' }}>
                <CostEstimate cost={experience.cost_estimate} showLabel={false} showTooltip={true} showDollarSigns={true} />
              </Box>
            </Box>
          )}
          {experience.max_planning_days > 0 && (
            <Box css={{
              '@media (max-width: 991px)': { textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' },
            }}>
              <Box color="fg.muted" fontSize={{ base: 'md', lg: 'sm' }} mb="1">Planning Time</Box>
              <Box color="fg" fontWeight="medium" fontSize={{ base: 'lg', lg: 'md' }}>
                <PlanningTime days={experience.max_planning_days} showLabel={false} showTooltip={true} size="md" />
              </Box>
            </Box>
          )}
        </Flex>

        {/* Action Buttons */}
        <Flex
          direction="column"
          gap={{ base: '2', lg: '3' }}
          css={{ '@media (max-width: 991px)': { alignItems: 'center', width: '100%' } }}
        >
          <ActionButtonsRow
            user={user}
            experience={experience}
            experienceId={experienceId}
            userHasExperience={userHasExperience}
            loading={loading}
            plansLoading={plansLoading}
            displayedPlannedDate={displayedPlannedDate}
            selectedPlan={selectedPlan}
            planButtonRef={planButtonRef}
            planBtnWidth={planBtnWidth}
            favHover={favHover}
            setFavHover={setFavHover}
            handleExperience={handleExperience}
            setShowDeleteModal={handleOpenDeleteExperienceModal}
            showDatePicker={isModalOpen(MODAL_NAMES.DATE_PICKER)}
            setShowDatePicker={setShowDatePickerState}
            setIsEditingDate={setIsEditingDate}
            setPlannedDate={setPlannedDate}
            lang={lang}
            variant="sidebar"
            activeTab={activeTab}
            onShare={handleShareExperience}
          />
        </Flex>
      </Box>
    </Box>
  );
}
