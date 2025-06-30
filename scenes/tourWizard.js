const { Scenes } = require('telegraf');

const greeting = require('../steps/greeting');
const askCity = require('../steps/askCity');
const askTravelPeriod = require('../steps/askTravelPeriod');
const askTravelDatesDetails = require('../steps/askTravelDatesDetails');
const askDepartureDate = require('../steps/askDepartureDate');
const askReturnDate = require('../steps/askReturnDate');
const askNights = require('../steps/askNights');
const askCompanions = require('../steps/askCompanions');
const askChildrenInfo = require('../steps/askChildrenInfo');
const askTourType = require('../steps/askTourType');
const askAccommodation = require('../steps/askAccommodation');
const askBudget = require('../steps/askBudget');
const askName = require('../steps/askName');
const askPhone = require('../steps/askPhone');

const tourQuestionnaire = new Scenes.WizardScene(
    'TOUR_QUESTIONNAIRE',
    greeting,
    askCity,
    askTravelPeriod,
    askTravelDatesDetails,
    askDepartureDate,
    askReturnDate,
    askNights,
    askCompanions,
    askChildrenInfo,
    askTourType,
    askAccommodation,
    askBudget,
    askName,
    askPhone
);

module.exports = tourQuestionnaire;